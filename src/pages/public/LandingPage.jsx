import React, { useState, useEffect } from "react";
import {
  ArrowRight, BookOpen, GraduationCap, ShieldCheck, CheckCircle2, X,
  Brain, Layers, ChevronDown, ClipboardList, UserPlus,
  Building2, Users, Target, TrendingUp, Lock, BarChart3,
  Zap, Flame, Menu, Check,
  Activity, Gauge, Database, Home, Mail, Download, Wifi,
  Accessibility, Bell, Facebook, Twitter, Instagram, Linkedin, Search,
  BarChart2
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
    desc: "Dashboards power proactive talent decisions, forecasting team capability gaps before they impact business delivery."
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
        @keyframes fillBar1 { from { width: 0%; } to { width: 82%; } }
        @keyframes fillBar2 { from { width: 0%; } to { width: 74%; } }
        @keyframes fillBar3 { from { width: 0%; } to { width: 61%; } }
        @keyframes fillBar4 { from { width: 0%; } to { width: 55%; } }

        .lp-card-hover {
          transition: border-color .15s ease, box-shadow .15s ease;
        }
        .lp-card-hover:hover {
          border-color: #CBD5E1 !important;
          box-shadow: 0 4px 16px -2px rgba(15, 23, 42, 0.06);
        }

        .lp-step-card {
          transition: border-color .15s ease, box-shadow .15s ease;
        }
        .lp-step-card:hover {
          border-color: #CBD5E1 !important;
          box-shadow: 0 4px 16px -2px rgba(15, 23, 42, 0.06);
        }

        .lp-nav-link {
          transition: color .14s ease;
          cursor: pointer;
          color: #475569;
          font-weight: 600;
          font-size: 13.5px;
        }
        .lp-nav-link:hover {
          color: #2563EB !important;
        }

        .lp-pill-hover {
          transition: background-color .14s ease, border-color .14s ease;
          cursor: pointer;
        }
        .lp-pill-hover:hover {
          border-color: #CBD5E1 !important;
          background: #F1F5F9 !important;
        }

        .action-btn-primary {
          background: #2563EB;
          color: #FFFFFF;
          transition: background-color .14s ease;
        }
        .action-btn-primary:hover {
          background: #1D4ED8;
        }
        .action-btn-primary:active {
          transform: scale(.99);
        }

        .action-btn-outline {
          background: #FFFFFF;
          color: #0F172A;
          border: 1px solid #CBD5E1;
          transition: background-color .14s ease, border-color .14s ease;
        }
        .action-btn-outline:hover {
          background: #F8FAFC;
          border-color: #94A3B8;
        }

        .lp-bar-1 { animation: fillBar1 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .lp-bar-2 { animation: fillBar2 1.0s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .lp-bar-3 { animation: fillBar3 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .lp-bar-4 { animation: fillBar4 1.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

        .lp-footer-link {
          color: #94A3B8;
          text-decoration: none;
          font-size: 13px;
          transition: color .14s ease;
          cursor: pointer;
        }
        .lp-footer-link:hover {
          color: #FFFFFF !important;
        }

        .lp-social-btn {
          width: 32px;
          height: 32px;
          border-radius: 6px;
          background: #1E293B;
          border: 1px solid #334155;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #94A3B8;
          transition: background-color .14s ease, color .14s ease;
          cursor: pointer;
        }
        .lp-social-btn:hover {
          background: #2563EB;
          color: #FFFFFF;
          border-color: #2563EB;
        }

        /* Interactive Phone Nav Pill Tabs */
        .phone-nav-item {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 9.5px;
          font-weight: 700;
          color: #64748B;
          cursor: pointer;
          transition: background-color .14s ease, color .14s ease;
        }
        .phone-nav-item.active {
          background: #2563EB;
          color: #FFFFFF !important;
        }

        /* Section Background Utilities */
        .lp-bg-hero {
          background-color: #FFFFFF;
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
          .lp-hero-h1 { font-size: 30px !important; line-height: 1.15 !important; }
          .lp-section-h2 { font-size: 22px !important; line-height: 1.2 !important; }
          .lp-section-inner { padding: 32px 14px !important; }
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
          
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", flexShrink: 0 }} onClick={() => handleNav("home")}>
            <img src="/train-ai-logo.png" alt="Train AI" style={{ height: 24, width: "auto", objectFit: "contain", display: "block" }} />
          </div>

          {/* Center Navigation Links */}
          <nav className="lp-desktop-nav" style={{ display: "flex", gap: 24, alignItems: "center" }}>
            <span className="lp-nav-link" onClick={() => handleNav("home")}>Home</span>
            <span className="lp-nav-link" onClick={() => handleNav("intelligence")}>Intelligence</span>
            <span className="lp-nav-link" onClick={() => handleNav("learners")}>Learners</span>
            <span className="lp-nav-link" onClick={() => handleNav("organisation")}>Organisation</span>
            <span className="lp-nav-link" onClick={() => handleNav("faq")}>FAQ</span>
          </nav>

          {/* Action CTAs */}
          <div className="lp-header-actions" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              className="lp-signin-btn lp-desktop-nav"
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
                width: 34, height: 34, borderRadius: 6, border: "1px solid #E2E8F0",
                background: "#F8FAFC", display: "none", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "#0F172A"
              }}
              aria-label="Toggle Mobile Navigation"
            >
              {mobileMenuOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
          </div>

        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div
            className="lp-mobile-drawer anim-fluid-entrance"
            style={{
              background: "rgba(255, 255, 255, 0.98)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              borderTop: "1px solid rgba(226, 232, 240, 0.9)",
              padding: "16px 20px 24px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              boxShadow: "0 16px 40px -10px rgba(15, 23, 42, 0.15)"
            }}
          >
            <span className="lp-nav-link anim-stagger-1" style={{ fontSize: 14, fontWeight: 700 }} onClick={() => handleNav("home")}>Home</span>
            <span className="lp-nav-link anim-stagger-2" style={{ fontSize: 14, fontWeight: 700 }} onClick={() => handleNav("intelligence")}>Intelligence</span>
            <span className="lp-nav-link anim-stagger-3" style={{ fontSize: 14, fontWeight: 700 }} onClick={() => handleNav("learners")}>Learners</span>
            <span className="lp-nav-link anim-stagger-4" style={{ fontSize: 14, fontWeight: 700 }} onClick={() => handleNav("organisation")}>Organisation</span>
            <span className="lp-nav-link anim-stagger-4" style={{ fontSize: 14, fontWeight: 700 }} onClick={() => handleNav("faq")}>FAQ</span>
            <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                className="action-btn-outline"
                style={{ width: "100%", padding: "10px", borderRadius: 8, fontWeight: 700, fontSize: 13 }}
                onClick={() => handleNav("signin")}
              >
                Sign In to Account
              </button>
              <button
                className="action-btn-primary"
                style={{ width: "100%", padding: "10px", borderRadius: 8, fontWeight: 700, fontSize: 13 }}
                onClick={() => handleNav("demo")}
              >
                Request a demo
              </button>
            </div>
          </div>
        )}
      </header>

      {/* =========================================================================
          SECTION 1: HERO SECTION
          ========================================================================= */}
      <section className="lp-bg-hero ambient-mesh-glow" style={{ width: "100%", position: "relative", borderBottom: "1px solid #E2E8F0" }}>
        <div className="lp-section-inner" style={{ maxWidth: 1180, margin: "0 auto", padding: "48px 20px 64px" }}>
          <div className="lp-hero-grid" style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 36, alignItems: "center" }}>
            
            {/* Left Column */}
            <div className="lp-hero-left" style={{ textAlign: "left" }}>
              
              {/* Badge */}
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 6,
                background: "#EFF6FF", border: "1px solid #C7D2FE",
                color: "#2563EB", fontSize: 11, fontWeight: 700, marginBottom: 16, letterSpacing: ".02em"
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#2563EB", display: "inline-block" }} />
                <span>AI WORKFORCE INTELLIGENCE PLATFORM</span>
              </div>

              {/* Headline */}
              <h1 className="lp-hero-h1" style={{ fontSize: "clamp(32px, 4vw, 52px)", fontWeight: 900, letterSpacing: "-0.035em", color: "#0F172A", margin: "0 0 14px", lineHeight: 1.1 }}>
                Measure<br />
                readiness,<br />
                <span style={{ color: "#2563EB" }}>
                  not completion.
                </span>
              </h1>

              {/* Subtitle */}
              <p style={{ fontSize: 15, color: "#475569", lineHeight: 1.55, margin: "0 0 22px", maxWidth: 500 }}>
                Train AI turns learning activity into decision-ready intelligence about workforce readiness, skill coverage and team capability — so leaders know who is ready, who is stuck, and where the gaps are.
              </p>

              {/* Dual CTAs */}
              <div className="lp-hero-ctas" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
                <button className="action-btn-primary" style={styles.startOrgBtn} onClick={() => handleNav("signin")}>
                  Start with your organisation <ArrowRight size={14} />
                </button>
                <button className="action-btn-outline" style={styles.requestDemoOutlineBtn} onClick={() => handleNav("demo")}>
                  Request a demo
                </button>
              </div>

              {/* 3 Metric Badges */}
              <div className="lp-hero-pills lp-hero-pill-wrap" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <div className="lp-pill-hover" style={styles.heroPill} onClick={() => scrollToId("intelligence")}>
                  <Layers size={15} color="#2563EB" />
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: "#0F172A" }}>Skill Graph</div>
                    <div style={{ fontSize: 10.5, color: "#64748B" }}>Held • developing • missing</div>
                  </div>
                </div>

                <div className="lp-pill-hover" style={styles.heroPill} onClick={() => scrollToId("intelligence")}>
                  <Gauge size={15} color="#2563EB" />
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: "#0F172A" }}>Readiness Score</div>
                    <div style={{ fontSize: 10.5, color: "#64748B" }}>Team • function • org</div>
                  </div>
                </div>

                <div className="lp-pill-hover" style={styles.heroPill} onClick={() => scrollToId("learners")}>
                  <Activity size={15} color="#2563EB" />
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: "#0F172A" }}>Live Signals</div>
                    <div style={{ fontSize: 10.5, color: "#64748B" }}>Assessments • progress</div>
                  </div>
                </div>
              </div>

            </div>

            {/* Right Column: Professional Editorial Team Photo + Telemetry Card */}
            <div className="lp-hero-right" style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
              
              {/* Authentic Photo */}
              <div style={{ width: "100%", maxWidth: 360, marginBottom: -32, position: "relative", zIndex: 1 }}>
                <img
                  src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800&auto=format&fit=crop&q=80"
                  alt="Train AI Professional Team"
                  style={{ width: "100%", height: 260, objectFit: "cover", borderRadius: 8, border: "1px solid #E2E8F0" }}
                />
              </div>

              {/* Grounded Workforce Telemetry Card */}
              <div style={{
                position: "relative", zIndex: 2, width: "100%", maxWidth: 420,
                background: "#FFFFFF", borderRadius: 8, padding: "18px 20px",
                border: "1px solid #CBD5E1", boxShadow: "0 4px 16px rgba(15,23,42,0.06)",
                textAlign: "left", boxSizing: "border-box"
              }}>
                
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: ".04em" }}>WORKFORCE INTELLIGENCE</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", marginTop: 1 }}>Readiness by team</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 700, color: "#2563EB", background: "#EFF6FF", padding: "2px 6px", borderRadius: 4 }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#2563EB", display: "inline-block" }} />
                    <span>Live Telemetry</span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 30, fontWeight: 900, color: "#0F172A", letterSpacing: "-0.03em" }}>71</span>
                  <span style={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>Organisation readiness</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#16A34A" }}>+4 this month</span>
                </div>

                {/* Progress Bars */}
                <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 14 }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 600, marginBottom: 3 }}>
                      <span style={{ color: "#334155" }}>Engineering</span>
                      <span style={{ color: "#2563EB", fontWeight: 700 }}>82 (+6)</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: "#EFF6FF", overflow: "hidden" }}>
                      <div className="lp-bar-1" style={{ height: "100%", background: "#2563EB", borderRadius: 2 }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 600, marginBottom: 3 }}>
                      <span style={{ color: "#334155" }}>Operations</span>
                      <span style={{ color: "#2563EB", fontWeight: 700 }}>74 (+3)</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: "#EFF6FF", overflow: "hidden" }}>
                      <div className="lp-bar-2" style={{ height: "100%", background: "#2563EB", borderRadius: 2 }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 600, marginBottom: 3 }}>
                      <span style={{ color: "#334155" }}>Compliance</span>
                      <span style={{ color: "#2563EB", fontWeight: 700 }}>61 (-2)</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: "#EFF6FF", overflow: "hidden" }}>
                      <div className="lp-bar-3" style={{ height: "100%", background: "#2563EB", borderRadius: 2 }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 600, marginBottom: 3 }}>
                      <span style={{ color: "#334155" }}>Sales</span>
                      <span style={{ color: "#2563EB", fontWeight: 700 }}>55 (+9)</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: "#EFF6FF", overflow: "hidden" }}>
                      <div className="lp-bar-4" style={{ height: "100%", background: "#2563EB", borderRadius: 2 }} />
                    </div>
                  </div>
                </div>

                {/* Bottom 3 Numbers */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, paddingTop: 10, borderTop: "1px solid #F1F5F9" }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A" }}>12</div>
                    <div style={{ fontSize: 10, color: "#64748B" }}>Skill gaps</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A" }}>38</div>
                    <div style={{ fontSize: 10, color: "#64748B" }}>Compliance due</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A" }}>6</div>
                    <div style={{ fontSize: 10, color: "#64748B" }}>Cohorts active</div>
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
        <div className="lp-section-inner" style={{ maxWidth: 1180, margin: "0 auto", padding: "36px 20px 44px" }}>
          
          <div style={{ textAlign: "left", marginBottom: 14 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#2563EB", letterSpacing: ".06em" }}>HOW WE BUILD IT</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, textAlign: "left" }}>
            {HOW_WE_BUILD_IT.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="lp-card-hover" style={{ background: "#FFFFFF", padding: "18px 18px", borderRadius: 10, border: "1px solid #E2E8F0" }}>
                  <div style={{ width: 32, height: 32, borderRadius: 6, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                    <Icon size={16} color="#2563EB" />
                  </div>
                  <h3 style={{ fontSize: 14.5, fontWeight: 800, color: "#0F172A", margin: "0 0 4px" }}>{item.title}</h3>
                  <p style={{ fontSize: 12.5, color: "#64748B", margin: 0, lineHeight: 1.45 }}>{item.desc}</p>
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
        <div className="lp-section-inner" style={{ maxWidth: 1180, margin: "0 auto", padding: "48px 20px 58px", textAlign: "left" }}>
          
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#2563EB", letterSpacing: ".06em" }}>THE WORKFORCE INTELLIGENCE LAYER</span>
          </div>

          <h2 className="lp-section-h2" style={{ fontSize: 30, fontWeight: 900, letterSpacing: "-0.03em", color: "#0F172A", margin: "0 0 8px" }}>
            Understand what your people<br />can actually do
          </h2>

          <p style={{ fontSize: 14.5, color: "#64748B", maxWidth: 620, margin: "0 0 28px", lineHeight: 1.5 }}>
            Available to admins and managers as an overview, the intelligence layer combines every available signal into outputs you can act on — never completion alone.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            
            <div className="lp-card-hover" style={{ background: "#FFFFFF", padding: "20px 20px", borderRadius: 10, border: "1px solid #E2E8F0" }}>
              <div style={{ width: 34, height: 34, borderRadius: 6, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                <Brain size={18} color="#2563EB" />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: "0 0 6px" }}>AI Skill Graph</h3>
              <p style={{ fontSize: 13, color: "#64748B", margin: 0, lineHeight: 1.5 }}>
                A live view of capability across a learner, team or organisation — what skills exist, what is developing, where the gaps are, and how capability grows over time.
              </p>
            </div>

            <div className="lp-card-hover" style={{ background: "#FFFFFF", padding: "20px 20px", borderRadius: 10, border: "1px solid #E2E8F0" }}>
              <div style={{ width: 34, height: 34, borderRadius: 6, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                <Gauge size={18} color="#2563EB" />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: "0 0 6px" }}>Workforce Readiness Score</h3>
              <p style={{ fontSize: 13, color: "#64748B", margin: 0, lineHeight: 1.5 }}>
                One readiness indicator per team, function and organisation, so leadership can answer: are we ready, which team is strongest, which team needs support now?
              </p>
            </div>

            <div className="lp-card-hover" style={{ background: "#FFFFFF", padding: "20px 20px", borderRadius: 10, border: "1px solid #E2E8F0" }}>
              <div style={{ width: 34, height: 34, borderRadius: 6, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                <BarChart3 size={18} color="#2563EB" />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: "0 0 6px" }}>Intelligence Dashboard</h3>
              <p style={{ fontSize: 13, color: "#64748B", margin: 0, lineHeight: 1.5 }}>
                A summary view built for decisions: skill gaps by department, readiness by team, progress and activity trends, plus high-level organisational insights.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* =========================================================================
          SECTION 4: THE LEARNER APP
          ========================================================================= */}
      <section id="learners" className="lp-bg-surface-tint" style={{ width: "100%" }}>
        <div className="lp-section-inner" style={{ maxWidth: 1180, margin: "0 auto", padding: "38px 20px 50px" }}>
          
          {/* Signals Pill Bar */}
          <div style={{ background: "#FFFFFF", padding: "12px 16px", borderRadius: 10, border: "1px solid #E2E8F0", marginBottom: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6, textAlign: "left" }}>
              SIGNALS FEEDING THE MODEL
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {SIGNALS.map((sig) => (
                <span key={sig} style={{ background: "#EFF6FF", color: "#2563EB", fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 4, border: "1px solid #C7D2FE" }}>
                  {sig}
                </span>
              ))}
            </div>
          </div>

          {/* The Learner App Grid */}
          <div style={{ textAlign: "left", marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#2563EB", letterSpacing: ".06em" }}>THE LEARNER APP</span>
          </div>

          <h2 className="lp-section-h2" style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.03em", color: "#0F172A", margin: "0 0 6px", textAlign: "left" }}>
            Four places. Zero confusion.
          </h2>

          <p style={{ fontSize: 14, color: "#64748B", maxWidth: 620, margin: "0 0 20px", lineHeight: 1.5, textAlign: "left" }}>
            Learners get a focused workspace with primary navigation at the bottom of the screen: Home, Courses, AI Coach, and Community. Tap the tabs on the left or the phone buttons to preview live.
          </p>

          <div className="lp-learner-grid" style={{ display: "grid", gridTemplateColumns: "1.25fr 0.75fr", gap: 20, alignItems: "stretch" }}>
            
            {/* Left Side: Rich Vertical Interactive Tab Stack */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, justifyContent: "space-between" }}>
              
              {/* Tab 1: Home */}
              <div
                className="lp-card-hover"
                onClick={() => setMobileLearnerTab("home")}
                style={{
                  background: mobileLearnerTab === "home" ? "#EFF6FF" : "#FFFFFF",
                  padding: "12px 14px", borderRadius: 8,
                  border: mobileLearnerTab === "home" ? "2px solid #2563EB" : "1px solid #E2E8F0",
                  cursor: "pointer", transition: "background-color .15s ease, border-color .15s ease"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 24, height: 24, borderRadius: 6, background: mobileLearnerTab === "home" ? "#2563EB" : "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", color: mobileLearnerTab === "home" ? "#fff" : "#2563EB" }}>
                      <Home size={13} />
                    </div>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", margin: 0 }}>Home Workspace</h3>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: mobileLearnerTab === "home" ? "#2563EB" : "#64748B", background: mobileLearnerTab === "home" ? "rgba(37,99,235,0.12)" : "#F1F5F9", padding: "1px 6px", borderRadius: 4 }}>
                    {mobileLearnerTab === "home" ? "Active Preview" : "Personalized"}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: "#64748B", margin: "2px 0 0", lineHeight: 1.4 }}>
                  Current sprint progress, career roadmap, active cohorts and daily streak tracker.
                </p>
              </div>

              {/* Tab 2: Courses */}
              <div
                className="lp-card-hover"
                onClick={() => setMobileLearnerTab("courses")}
                style={{
                  background: mobileLearnerTab === "courses" ? "#EFF6FF" : "#FFFFFF",
                  padding: "12px 14px", borderRadius: 8,
                  border: mobileLearnerTab === "courses" ? "2px solid #2563EB" : "1px solid #E2E8F0",
                  cursor: "pointer", transition: "background-color .15s ease, border-color .15s ease"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 24, height: 24, borderRadius: 6, background: mobileLearnerTab === "courses" ? "#2563EB" : "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", color: mobileLearnerTab === "courses" ? "#fff" : "#2563EB" }}>
                      <BookOpen size={13} />
                    </div>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", margin: 0 }}>Courses &amp; Masterclasses</h3>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: mobileLearnerTab === "courses" ? "#2563EB" : "#64748B", background: mobileLearnerTab === "courses" ? "rgba(37,99,235,0.12)" : "#F1F5F9", padding: "1px 6px", borderRadius: 4 }}>
                    {mobileLearnerTab === "courses" ? "Active Preview" : "49 Courses"}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: "#64748B", margin: "2px 0 0", lineHeight: 1.4 }}>
                  Executive masterclasses, spotlight carousels, assigned tracks, and video trailers.
                </p>
              </div>

              {/* Tab 3: AI Coach */}
              <div
                className="lp-card-hover"
                onClick={() => setMobileLearnerTab("ai")}
                style={{
                  background: mobileLearnerTab === "ai" ? "#EFF6FF" : "#FFFFFF",
                  padding: "12px 14px", borderRadius: 8,
                  border: mobileLearnerTab === "ai" ? "2px solid #2563EB" : "1px solid #E2E8F0",
                  cursor: "pointer", transition: "background-color .15s ease, border-color .15s ease"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 24, height: 24, borderRadius: 6, background: mobileLearnerTab === "ai" ? "#2563EB" : "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", color: mobileLearnerTab === "ai" ? "#fff" : "#2563EB" }}>
                      <Zap size={13} />
                    </div>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", margin: 0 }}>AI Neural Coach</h3>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: mobileLearnerTab === "ai" ? "#2563EB" : "#64748B", background: mobileLearnerTab === "ai" ? "rgba(37,99,235,0.12)" : "#F1F5F9", padding: "1px 6px", borderRadius: 4 }}>
                    {mobileLearnerTab === "ai" ? "Active Preview" : "24/7 Neural Tutor"}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: "#64748B", margin: "2px 0 0", lineHeight: 1.4 }}>
                  AI Learning Coach, custom adaptive assessment generator, and debugging assistant.
                </p>
              </div>

              {/* Tab 4: Community */}
              <div
                className="lp-card-hover"
                onClick={() => setMobileLearnerTab("community")}
                style={{
                  background: mobileLearnerTab === "community" ? "#EFF6FF" : "#FFFFFF",
                  padding: "12px 14px", borderRadius: 8,
                  border: mobileLearnerTab === "community" ? "2px solid #2563EB" : "1px solid #E2E8F0",
                  cursor: "pointer", transition: "background-color .15s ease, border-color .15s ease"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 24, height: 24, borderRadius: 6, background: mobileLearnerTab === "community" ? "#2563EB" : "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", color: mobileLearnerTab === "community" ? "#fff" : "#2563EB" }}>
                      <Users size={13} />
                    </div>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", margin: 0 }}>Community Hub</h3>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: mobileLearnerTab === "community" ? "#2563EB" : "#64748B", background: mobileLearnerTab === "community" ? "rgba(37,99,235,0.12)" : "#F1F5F9", padding: "1px 6px", borderRadius: 4 }}>
                    {mobileLearnerTab === "community" ? "Active Preview" : "Peer Network"}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: "#64748B", margin: "2px 0 0", lineHeight: 1.4 }}>
                  Community hub, pinned faculty announcements, live polls, and student discussions.
                </p>
              </div>

              {/* Bottom Feature Badges Bar */}
              <div style={{ background: "#FFFFFF", borderRadius: 8, padding: "8px 12px", border: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "#334155" }}>
                  <Flame size={12} color="#EA580C" /> Daily Streaks
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "#334155" }}>
                  <Target size={12} color="#2563EB" /> Adaptive Quizzes
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "#334155" }}>
                  <CheckCircle2 size={12} color="#16A34A" /> Micro-Certs
                </span>
              </div>

            </div>

            {/* Right Side: PROPORTIONAL LIVE MOBILE PHONE PREVIEW */}
            <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
              
              {/* Phone Chassis */}
              <div style={{
                width: 270, height: 475, background: "#0F172A", borderRadius: 10,
                padding: 6, border: "2px solid #334155", position: "relative",
                display: "flex", flexDirection: "column", boxSizing: "border-box"
              }}>
                
                {/* Screen */}
                <div style={{
                  flex: 1, background: "#F8FAFC", borderRadius: 10, overflow: "hidden",
                  display: "flex", flexDirection: "column", position: "relative"
                }}>
                  
                  {/* Top Bar */}
                  <div style={{ padding: "8px 10px 6px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#FFFFFF", borderBottom: "1px solid #F1F5F9" }}>
                    <img src="/train-ai-logo.png" alt="TRAIN.AI" style={{ height: 14, width: "auto" }} />
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 2, background: "#FFF7ED", padding: "1px 5px", borderRadius: 4, fontSize: 8.5, fontWeight: 700, color: "#EA580C" }}>
                        <Flame size={9} color="#EA580C" /> 1
                      </div>
                      <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#2563EB", color: "#fff", fontSize: 8.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        J
                      </div>
                    </div>
                  </div>

                  {/* Body */}
                  <div style={{ flex: 1, overflowY: "auto", padding: "8px", textAlign: "left" }}>
                    
                    {/* TAB 1: HOME */}
                    {mobileLearnerTab === "home" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        
                        {/* Welcome Card */}
                        <div style={{
                          background: "#0F172A",
                          borderRadius: 8, padding: "9px 10px", color: "#FFFFFF"
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div>
                              <div style={{ fontSize: 10.5, color: "#94A3B8" }}>Welcome back,</div>
                              <div style={{ fontSize: 12, fontWeight: 800, color: "#FFFFFF" }}>John</div>
                            </div>
                            <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#2563EB", fontSize: 8, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>J</div>
                          </div>

                          <div style={{ fontSize: 8.5, color: "#94A3B8", marginTop: 2 }}>
                            0 of 5 lessons done. Continue in <span style={{ color: "#60A5FA", fontWeight: 600 }}>AI Fundamentals</span>.
                          </div>

                          {/* Sprint Goal */}
                          <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 6, padding: "4px 6px", marginTop: 6, border: "1px solid rgba(255,255,255,0.1)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 8, fontWeight: 700, marginBottom: 2 }}>
                              <span style={{ color: "#E2E8F0" }}>Sprint Goal (0/5)</span>
                              <span style={{ color: "#34D399" }}>0% Done</span>
                            </div>
                            <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.15)", overflow: "hidden" }}>
                              <div style={{ width: "8%", height: "100%", background: "#34D399", borderRadius: 2 }} />
                            </div>
                          </div>
                        </div>

                        {/* Course Catalog CTA */}
                        <div style={{ background: "#FFFFFF", borderRadius: 8, border: "1px solid #E2E8F0", padding: "7px", textAlign: "center" }}>
                          <div style={{ fontSize: 9, color: "#475569" }}>No active course yet. Browse catalog to start.</div>
                          <button
                            onClick={() => setMobileLearnerTab("courses")}
                            style={{ width: "100%", background: "#2563EB", color: "#fff", border: "none", borderRadius: 6, padding: "5px 8px", fontSize: 9.5, fontWeight: 700, marginTop: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, cursor: "pointer" }}
                          >
                            <BookOpen size={10} /> Browse courses
                          </button>
                        </div>

                        {/* Cohort Status */}
                        <div style={{ background: "#FFFFFF", borderRadius: 8, border: "1px solid #E2E8F0", padding: "6px 8px", display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 20, height: 20, borderRadius: 4, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Users size={10} color="#2563EB" />
                          </div>
                          <div>
                            <div style={{ fontSize: 7.5, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>YOUR COHORT</div>
                            <div style={{ fontSize: 9, color: "#334155", fontWeight: 600 }}>Not part of a cohort yet</div>
                          </div>
                        </div>

                        {/* Roadmap */}
                        <div style={{ background: "#FFFFFF", borderRadius: 8, border: "1px solid #E2E8F0", padding: "7px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 3, color: "#2563EB", fontSize: 9, fontWeight: 700 }}>
                            <TrendingUp size={10} /> Career Roadmap • UX &amp; AI
                          </div>
                          <div style={{ fontSize: 8, color: "#64748B", marginTop: 1 }}>
                            Current: <span style={{ fontWeight: 600, color: "#0F172A" }}>Junior Designer</span>
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2, marginTop: 4 }}>
                            <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 4, padding: "2px", textAlign: "center" }}>
                              <CheckCircle2 size={7} color="#10B981" style={{ margin: "0 auto" }} />
                              <div style={{ fontSize: 7, fontWeight: 700, color: "#0F172A" }}>Junior</div>
                            </div>
                            <div style={{ background: "#EFF6FF", border: "1px solid #C7D2FE", borderRadius: 4, padding: "2px", textAlign: "center" }}>
                              <Zap size={7} color="#2563EB" style={{ margin: "0 auto" }} />
                              <div style={{ fontSize: 7, fontWeight: 700, color: "#2563EB" }}>Tokens</div>
                            </div>
                            <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 4, padding: "2px", textAlign: "center" }}>
                              <Lock size={7} color="#94A3B8" style={{ margin: "0 auto" }} />
                              <div style={{ fontSize: 7, fontWeight: 600, color: "#64748B" }}>Spatial</div>
                            </div>
                            <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 4, padding: "2px", textAlign: "center" }}>
                              <Lock size={7} color="#94A3B8" style={{ margin: "0 auto" }} />
                              <div style={{ fontSize: 7, fontWeight: 600, color: "#64748B" }}>Lead</div>
                            </div>
                          </div>
                        </div>

                      </div>
                    )}

                    {/* TAB 2: COURSES */}
                    {mobileLearnerTab === "courses" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        
                        <div style={{
                          background: "#0F172A",
                          borderRadius: 8, padding: "8px 9px", color: "#FFFFFF"
                        }}>
                          <div style={{ fontSize: 7.5, fontWeight: 700, color: "#C7D2FE", background: "rgba(255,255,255,0.1)", padding: "1px 4px", borderRadius: 3, display: "inline-block" }}>
                            SPOTLIGHT
                          </div>

                          <div style={{ fontSize: 10.5, fontWeight: 800, marginTop: 3, lineHeight: 1.2 }}>
                            Spatial Computing Foundations
                          </div>

                          <div style={{ fontSize: 8, color: "#CBD5E1", marginTop: 1 }}>
                            3D spatial user experiences and tokens.
                          </div>

                          <button style={{ width: "100%", background: "#2563EB", color: "#fff", border: "none", borderRadius: 4, padding: "4px 6px", fontSize: 8.5, fontWeight: 700, marginTop: 5 }}>
                            Explore Masterclass →
                          </button>
                        </div>

                        <div style={{ display: "flex", gap: 3 }}>
                          <span style={{ background: "#2563EB", color: "#fff", padding: "1px 6px", borderRadius: 4, fontSize: 8.5, fontWeight: 700 }}>All Courses (49)</span>
                          <span style={{ background: "#FFFFFF", color: "#64748B", border: "1px solid #E2E8F0", padding: "1px 6px", borderRadius: 4, fontSize: 8.5, fontWeight: 600 }}>Assigned (2)</span>
                        </div>

                        <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 6, padding: "3px 6px", display: "flex", alignItems: "center", gap: 4, fontSize: 8.5, color: "#94A3B8" }}>
                          <Search size={9} /> Search masterclasses...
                        </div>

                        <div style={{ background: "#FFFFFF", borderRadius: 8, border: "1px solid #E2E8F0", padding: "5px 7px", display: "flex", gap: 5, alignItems: "center" }}>
                          <div style={{ width: 24, height: 24, borderRadius: 4, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <Brain size={12} color="#2563EB" />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 8.5, fontWeight: 700, color: "#0F172A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Prompt Engineering &amp; LLMs</div>
                            <div style={{ fontSize: 7.5, color: "#64748B" }}>12 modules • ⭐ 4.9</div>
                          </div>
                        </div>

                      </div>
                    )}

                    {/* TAB 3: AI COACH */}
                    {mobileLearnerTab === "ai" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        
                        <div style={{
                          background: "#0F172A",
                          borderRadius: 8, padding: "8px 9px", color: "#FFFFFF"
                        }}>
                          <div style={{ fontSize: 10.5, fontWeight: 800 }}>AI Learning Coach</div>
                          <div style={{ fontSize: 8, color: "#CBD5E1", marginTop: 1 }}>
                            Ask questions, debug code, and take practice quizzes.
                          </div>

                          <div style={{ display: "flex", gap: 3, marginTop: 4 }}>
                            <span style={{ background: "rgba(255,255,255,0.12)", color: "#C7D2FE", padding: "1px 5px", borderRadius: 3, fontSize: 8, fontWeight: 700 }}>10 credits</span>
                          </div>
                        </div>

                        <div style={{ background: "#FFFFFF", borderRadius: 8, border: "1px solid #E2E8F0", padding: "7px" }}>
                          <div style={{ fontSize: 9.5, fontWeight: 700, color: "#0F172A" }}>AI Assessment Generator</div>
                          <div style={{ fontSize: 8, color: "#64748B", marginBottom: 3 }}>Custom quiz tuned to skillset</div>

                          <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 4, padding: "3px 5px", fontSize: 8, color: "#475569", marginBottom: 4 }}>
                            e.g. LangChain RAG, Figma
                          </div>

                          <button style={{ width: "100%", background: "#2563EB", color: "#fff", border: "none", borderRadius: 4, padding: "4px 6px", fontSize: 8.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}>
                            ⚡ Generate &amp; Start Quiz
                          </button>
                        </div>

                        <div style={{ background: "#FFFFFF", borderRadius: 6, border: "1px solid #E2E8F0", padding: "5px 7px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, fontWeight: 700 }}>
                            <span style={{ color: "#0F172A" }}>Daily Goal</span>
                            <span style={{ color: "#2563EB" }}>1 of 3 Done</span>
                          </div>
                          <div style={{ height: 3, borderRadius: 2, background: "#EFF6FF", overflow: "hidden", marginTop: 2 }}>
                            <div style={{ width: "33%", height: "100%", background: "#2563EB", borderRadius: 2 }} />
                          </div>
                        </div>

                      </div>
                    )}

                    {/* TAB 4: COMMUNITY */}
                    {mobileLearnerTab === "community" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        
                        <div style={{
                          background: "#0F172A",
                          borderRadius: 8, padding: "8px 9px", color: "#FFFFFF"
                        }}>
                          <div style={{ fontSize: 10.5, fontWeight: 800 }}>Train AI Community</div>
                          <div style={{ fontSize: 8, color: "#CBD5E1", marginTop: 1 }}>
                            Share projects, ask questions, and collaborate.
                          </div>
                        </div>

                        <div style={{ background: "#FFFFFF", borderRadius: 8, border: "1px solid #E2E8F0", padding: "7px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 7.5, fontWeight: 700, color: "#2563EB", marginBottom: 2 }}>
                            <BarChart2 size={9} /> POLL • 218 Votes
                          </div>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "#0F172A", marginBottom: 3 }}>
                            Which LLM orchestrator in production?
                          </div>
                          
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <div
                              onClick={() => { setPollVoted(true); setSelectedPollOption(0); }}
                              style={{
                                background: selectedPollOption === 0 && pollVoted ? "#EFF6FF" : "#F8FAFC",
                                border: selectedPollOption === 0 && pollVoted ? "1px solid #2563EB" : "1px solid #E2E8F0",
                                borderRadius: 3, padding: "2px 5px", fontSize: 8, fontWeight: 600,
                                display: "flex", justifyContent: "space-between", cursor: "pointer"
                              }}
                            >
                              <span>LangChain / LangGraph</span>
                              <span style={{ color: "#2563EB" }}>{pollVoted ? "64%" : "Vote"}</span>
                            </div>

                            <div
                              onClick={() => { setPollVoted(true); setSelectedPollOption(1); }}
                              style={{
                                background: selectedPollOption === 1 && pollVoted ? "#EFF6FF" : "#F8FAFC",
                                border: selectedPollOption === 1 && pollVoted ? "1px solid #2563EB" : "1px solid #E2E8F0",
                                borderRadius: 3, padding: "2px 5px", fontSize: 8, fontWeight: 600,
                                display: "flex", justifyContent: "space-between", cursor: "pointer"
                              }}
                            >
                              <span>Vercel AI SDK</span>
                              <span style={{ color: "#2563EB" }}>{pollVoted ? "28%" : "Vote"}</span>
                            </div>
                          </div>
                        </div>

                        <div style={{ background: "#FFFFFF", borderRadius: 8, border: "1px solid #E2E8F0", padding: "5px 7px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 3, marginBottom: 1 }}>
                            <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#10B981", color: "#fff", fontSize: 7, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>MK</div>
                            <div style={{ fontSize: 8.5, fontWeight: 700, color: "#0F172A" }}>Marcus K.</div>
                          </div>
                          <div style={{ fontSize: 8, color: "#334155", lineHeight: 1.25 }}>
                            pgvector with HNSW index had 4ms latency in benchmark lab!
                          </div>
                        </div>

                      </div>
                    )}

                  </div>

                  {/* Navigation Bar */}
                  <div style={{
                    height: 36, background: "#FFFFFF", borderTop: "1px solid #E2E8F0",
                    display: "flex", alignItems: "center", justifyContent: "space-around",
                    padding: "0 2px"
                  }}>
                    <div
                      className={`phone-nav-item ${mobileLearnerTab === "home" ? "active" : ""}`}
                      onClick={() => setMobileLearnerTab("home")}
                    >
                      <Home size={11} />
                      {mobileLearnerTab === "home" && <span>Home</span>}
                    </div>

                    <div
                      className={`phone-nav-item ${mobileLearnerTab === "courses" ? "active" : ""}`}
                      onClick={() => setMobileLearnerTab("courses")}
                    >
                      <BookOpen size={11} />
                      {mobileLearnerTab === "courses" && <span>Courses</span>}
                    </div>

                    <div
                      className={`phone-nav-item ${mobileLearnerTab === "ai" ? "active" : ""}`}
                      onClick={() => setMobileLearnerTab("ai")}
                    >
                      <Zap size={11} />
                      {mobileLearnerTab === "ai" && <span>AI</span>}
                    </div>

                    <div
                      className={`phone-nav-item ${mobileLearnerTab === "community" ? "active" : ""}`}
                      onClick={() => setMobileLearnerTab("community")}
                    >
                      <Users size={11} />
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
          SECTION 5: THE ORGANISATION APP
          ========================================================================= */}
      <section id="organisation" className="lp-bg-surface-2" style={{ width: "100%" }}>
        <div className="lp-section-inner" style={{ maxWidth: 1180, margin: "0 auto", padding: "48px 20px 58px", textAlign: "left" }}>
          
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#2563EB", letterSpacing: ".06em" }}>THE ORGANISATION APP</span>
          </div>

          <h2 className="lp-section-h2" style={{ fontSize: 30, fontWeight: 900, letterSpacing: "-0.03em", color: "#0F172A", margin: "0 0 8px" }}>
            One workspace, three views
          </h2>

          <p style={{ fontSize: 14.5, color: "#64748B", maxWidth: 660, margin: "0 0 28px", lineHeight: 1.5 }}>
            Instructors, managers and admins work in the same organisation app. Each person sees only the view their role allows — no separate dashboards to maintain.
          </p>

          {/* 3 Column Role Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 16 }}>
            
            {/* Instructor View */}
            <div className="lp-card-hover" style={{ background: "#FFFFFF", padding: "20px 20px", borderRadius: 10, border: "1px solid #E2E8F0", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <GraduationCap size={16} color="#2563EB" />
                <span style={{ fontSize: 11, fontWeight: 700, color: "#2563EB", letterSpacing: ".05em" }}>INSTRUCTOR VIEW</span>
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: "0 0 10px" }}>Run programmes, not spreadsheets</h3>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, color: "#475569" }}>
                <li style={{ display: "flex", gap: 6 }}>• <span>Cohort creation, control and adjustment</span></li>
                <li style={{ display: "flex", gap: 6 }}>• <span>Session scheduling and resources</span></li>
                <li style={{ display: "flex", gap: 6 }}>• <span>Assessment creation and grading</span></li>
                <li style={{ display: "flex", gap: 6 }}>• <span>Progress monitoring by course and level</span></li>
                <li style={{ display: "flex", gap: 6 }}>• <span>Direct learner messaging and feedback notes</span></li>
              </ul>
            </div>

            {/* Manager View */}
            <div className="lp-card-hover" style={{ background: "#FFFFFF", padding: "20px 20px", borderRadius: 10, border: "1px solid #E2E8F0", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <TrendingUp size={16} color="#2563EB" />
                <span style={{ fontSize: 11, fontWeight: 700, color: "#2563EB", letterSpacing: ".05em" }}>MANAGER VIEW</span>
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: "0 0 10px" }}>See who is ready and who needs support</h3>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, color: "#475569" }}>
                <li style={{ display: "flex", gap: 6 }}>• <span>Direct report progress</span></li>
                <li style={{ display: "flex", gap: 6 }}>• <span>Team summary</span></li>
                <li style={{ display: "flex", gap: 6 }}>• <span>Team readiness score</span></li>
                <li style={{ display: "flex", gap: 6 }}>• <span>Team skill snapshot</span></li>
                <li style={{ display: "flex", gap: 6 }}>• <span>Department feedback notes</span></li>
              </ul>
            </div>

            {/* Admin View */}
            <div className="lp-card-hover" style={{ background: "#FFFFFF", padding: "20px 20px", borderRadius: 10, border: "1px solid #E2E8F0", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <ShieldCheck size={16} color="#2563EB" />
                <span style={{ fontSize: 11, fontWeight: 700, color: "#2563EB", letterSpacing: ".05em" }}>ADMIN VIEW</span>
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: "0 0 10px" }}>Manage learning at scale</h3>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, color: "#475569" }}>
                <li style={{ display: "flex", gap: 6 }}>• <span>Bulk onboarding and offboarding</span></li>
                <li style={{ display: "flex", gap: 6 }}>• <span>Learning track and course assignment</span></li>
                <li style={{ display: "flex", gap: 6 }}>• <span>Compliance tracking and organisation dashboard</span></li>
                <li style={{ display: "flex", gap: 6 }}>• <span>Certificate settings and AI moderation controls</span></li>
                <li style={{ display: "flex", gap: 6 }}>• <span>Role management, SSO, API, audit and export controls</span></li>
              </ul>
            </div>

          </div>

          {/* Bottom 2 Connected Architecture Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
            
            <div className="lp-card-hover" style={{ background: "#FFFFFF", padding: "16px 18px", borderRadius: 8, border: "1px solid #E2E8F0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <Users size={15} color="#2563EB" />
                <h4 style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", margin: 0 }}>Learner side, connected</h4>
              </div>
              <p style={{ fontSize: 12, color: "#64748B", margin: 0, lineHeight: 1.45 }}>
                Assigned courses, cohort sessions and instructor messages appear straight in the learner app, with notifications and reminders attached.
              </p>
            </div>

            <div className="lp-card-hover" style={{ background: "#FFFFFF", padding: "16px 18px", borderRadius: 8, border: "1px solid #E2E8F0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <Database size={15} color="#2563EB" />
                <h4 style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", margin: 0 }}>Multi-tenant by design</h4>
              </div>
              <p style={{ fontSize: 12, color: "#64748B", margin: 0, lineHeight: 1.45 }}>
                Every organisation's data is separated and permission-enforced, with audit logging and export controls built in.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* =========================================================================
          SECTION 6: HOW IT WORKS
          ========================================================================= */}
      <section id="how-it-works" className="lp-bg-surface-1" style={{ width: "100%" }}>
        <div className="lp-section-inner" style={{ maxWidth: 1180, margin: "0 auto", padding: "48px 20px 58px", textAlign: "center" }}>
          
          <h2 className="lp-section-h2" style={{ fontSize: 30, fontWeight: 900, letterSpacing: "-0.03em", color: "#0F172A", margin: "0 0 6px" }}>
            How It Works
          </h2>
          <p style={{ fontSize: 14.5, color: "#64748B", maxWidth: 500, margin: "0 auto 30px" }}>
            Move from onboarding to measurable workforce readiness
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, textAlign: "left" }}>
            
            {/* Step 1 */}
            <div className="lp-step-card" style={{ background: "#FFFFFF", borderRadius: 10, padding: "22px 18px", border: "1px solid #E2E8F0" }}>
              <div style={{ width: 34, height: 34, borderRadius: 6, background: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", marginBottom: 12 }}>
                <UserPlus size={17} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: "0 0 6px" }}>1. Onboard Your People</h3>
              <p style={{ fontSize: 12.5, color: "#64748B", margin: 0, lineHeight: 1.5 }}>
                Invite learners, instructors and managers, then organise them by team, cohort and learning need.
              </p>
            </div>

            {/* Step 2 */}
            <div className="lp-step-card" style={{ background: "#FFFFFF", borderRadius: 10, padding: "22px 18px", border: "1px solid #E2E8F0" }}>
              <div style={{ width: 34, height: 34, borderRadius: 6, background: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", marginBottom: 12 }}>
                <BookOpen size={17} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: "0 0 6px" }}>2. Assign &amp; Develop</h3>
              <p style={{ fontSize: 12.5, color: "#64748B", margin: 0, lineHeight: 1.5 }}>
                Build or curate courses, assign required learning and support progress through instructors and AI tools.
              </p>
            </div>

            {/* Step 3 */}
            <div className="lp-step-card" style={{ background: "#FFFFFF", borderRadius: 10, padding: "22px 18px", border: "1px solid #E2E8F0" }}>
              <div style={{ width: 34, height: 34, borderRadius: 6, background: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", marginBottom: 12 }}>
                <TrendingUp size={17} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: "0 0 6px" }}>3. Measure Readiness</h3>
              <p style={{ fontSize: 12.5, color: "#64748B", margin: 0, lineHeight: 1.5 }}>
                Track skills, assessments, compliance, certificates and workforce readiness from live business dashboards.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* =========================================================================
          SECTION 7: ENTERPRISE TRUST & DATA SECURITY
          ========================================================================= */}
      <section id="trust" className="lp-bg-surface-2" style={{ width: "100%" }}>
        <div className="lp-section-inner" style={{ maxWidth: 1180, margin: "0 auto", padding: "44px 20px 54px", textAlign: "left" }}>
          
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#2563EB", letterSpacing: ".06em" }}>ENTERPRISE TRUST</span>
          </div>

          <h2 className="lp-section-h2" style={{ fontSize: 30, fontWeight: 900, letterSpacing: "-0.03em", color: "#0F172A", margin: "0 0 8px" }}>
            Trust is part of the product
          </h2>

          <p style={{ fontSize: 14.5, color: "#64748B", maxWidth: 620, margin: "0 0 26px", lineHeight: 1.5 }}>
            Permissions, privacy, auditability and data ownership are built in — not added later.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
            {TRUST_FEATURES.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="lp-card-hover" style={{ background: "#FFFFFF", padding: "18px 18px", borderRadius: 8, border: "1px solid #E2E8F0" }}>
                  <div style={{ width: 32, height: 32, borderRadius: 6, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                    <Icon size={16} color="#2563EB" />
                  </div>
                  <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", margin: "0 0 4px" }}>{item.title}</h3>
                  <p style={{ fontSize: 12.5, color: "#64748B", margin: 0, lineHeight: 1.45 }}>{item.desc}</p>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* =========================================================================
          SECTION 8: FAQ ACCORDION
          ========================================================================= */}
      <section id="faq" className="lp-bg-surface-1" style={{ width: "100%" }}>
        <div className="lp-section-inner" style={{ maxWidth: 820, margin: "0 auto", padding: "48px 20px 60px", textAlign: "left" }}>
          
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <h2 className="lp-section-h2" style={{ fontSize: 30, fontWeight: 900, letterSpacing: "-0.035em", color: "#0F172A", margin: "0 0 6px" }}>
              Frequently Asked Questions
            </h2>
            <p style={{ fontSize: 14.5, color: "#64748B", margin: 0 }}>
              Got questions? We've got answers. Find everything you need to know about Train AI.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {FAQ_ITEMS.map((item, i) => {
              const isOpen = openFaq === i;
              return (
                <div
                  key={item.q}
                  className="tai-card tai-card-hover"
                  style={{
                    background: "rgba(255, 255, 255, 0.88)",
                    backdropFilter: "blur(14px)",
                    WebkitBackdropFilter: "blur(14px)",
                    border: "1px solid rgba(226, 232, 240, 0.85)",
                    borderRadius: 10,
                    padding: "2px 20px"
                  }}
                >
                  <button
                    type="button"
                    style={{
                      width: "100%", border: "none", background: "transparent", cursor: "pointer",
                      padding: "14px 0", display: "flex", alignItems: "center", justifyContent: "space-between",
                      gap: 10, fontSize: 14.5, fontWeight: 700, color: "#0F172A", textAlign: "left"
                    }}
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    aria-expanded={isOpen}
                  >
                    <span>{item.q}</span>
                    <ChevronDown
                      size={16}
                      color="#64748B"
                      className={`rotator-chevron ${isOpen ? "rotator-chevron-open" : ""}`}
                      style={{ flexShrink: 0 }}
                    />
                  </button>
                  {isOpen && <p className="anim-fluid-entrance" style={{ margin: "0 0 14px", fontSize: 13, color: "#64748B", lineHeight: 1.55 }}>{item.a}</p>}
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* =========================================================================
          SECTION 9: PRE-FOOTER CTA
          ========================================================================= */}
      <section style={{ width: "100%", background: "#FFFFFF", padding: "36px 20px" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div style={{
            background: "#2563EB",
            borderRadius: 8, padding: "40px 24px", textAlign: "center"
          }}>
            <h2 style={{ fontSize: "clamp(22px, 3.2vw, 34px)", fontWeight: 900, letterSpacing: "-0.035em", margin: "0 0 10px", color: "#FFFFFF", lineHeight: 1.15 }}>
              Ready to Build a Workforce That Is Ready for<br />What's Next?
            </h2>
            
            <p style={{ fontSize: 14.5, color: "#EFF6FF", maxWidth: 600, margin: "0 auto 20px", lineHeight: 1.5 }}>
              Bring courses, cohorts, compliance and workforce intelligence together in one business LMS.
            </p>

            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 18 }}>
              <button
                className="action-btn-primary"
                style={{ background: "#FFFFFF", color: "#2563EB", fontWeight: 700, padding: "10px 20px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13.5, display: "inline-flex", alignItems: "center", gap: 6 }}
                onClick={() => handleNav("signin")}
              >
                Get Started <ArrowRight size={14} />
              </button>
              <button
                style={{ background: "rgba(255,255,255,0.12)", color: "#FFFFFF", fontWeight: 600, padding: "10px 18px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 13.5 }}
                onClick={() => handleNav("signin")}
              >
                Sign In to Train AI
              </button>
              <button
                style={{ background: "transparent", color: "#FFFFFF", fontWeight: 600, padding: "10px 18px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 13.5 }}
                onClick={() => handleNav("demo")}
              >
                Request a demo
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "center", gap: 14, flexWrap: "wrap", fontSize: 11.5, color: "#EFF6FF", fontWeight: 600 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#34D399" }} />
                Role-based access
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#34D399" }} />
                Organisation-ready
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#34D399" }} />
                Secure learner data
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 10: DARK ENTERPRISE FOOTER
          ========================================================================= */}
      <footer style={{ background: "#0B1120", color: "#FFFFFF", paddingTop: 36, paddingBottom: 28, borderTop: "1px solid #1E293B" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 20px" }}>
          
          {/* Newsletter Box */}
          <div style={{
            background: "#111827", borderRadius: 10, padding: "24px 20px",
            border: "1px solid #1E293B", textAlign: "center", marginBottom: 36
          }}>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: "#FFFFFF", margin: "0 0 4px" }}>
              Stay Updated
            </h3>
            <p style={{ fontSize: 12.5, color: "#94A3B8", margin: "0 0 14px" }}>
              Get the latest courses, features, and learning tips delivered to your inbox.
            </p>

            {newsletterSubscribed ? (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", background: "rgba(16,185,129,0.15)", color: "#34D399", borderRadius: 6, fontWeight: 600, fontSize: 12.5 }}>
                <CheckCircle2 size={15} />
                <span>Thank you for subscribing! We will keep you updated.</span>
              </div>
            ) : (
              <form onSubmit={handleNewsletterSubmit} style={{ display: "flex", maxWidth: 400, margin: "0 auto", gap: 6, flexWrap: "wrap" }}>
                <input
                  type="email"
                  required
                  placeholder="Enter your email"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  style={{
                    flex: 1, minWidth: 170, padding: "8px 12px", borderRadius: 6,
                    border: "1px solid #334155", background: "#0B1120", color: "#FFFFFF",
                    fontSize: 12.5, outline: "none"
                  }}
                />
                <button
                  type="submit"
                  className="action-btn-primary"
                  style={{
                    border: "none", padding: "8px 16px", borderRadius: 6, fontWeight: 700, fontSize: 12.5,
                    cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5
                  }}
                >
                  <Mail size={13} /> Subscribe
                </button>
              </form>
            )}
          </div>

          {/* Footer Navigation Columns */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 24, marginBottom: 32, textAlign: "left" }}>
            
            {/* Brand column with Dark Mode Logo */}
            <div>
              <img src="/logo-dark.png" alt="Train AI" style={{ height: 22, width: "auto", objectFit: "contain", display: "block", marginBottom: 10 }} />
              <p style={{ fontSize: 12, color: "#94A3B8", lineHeight: 1.5, margin: "0 0 14px", maxWidth: 260 }}>
                AI-powered workforce learning and intelligence for modern businesses.
              </p>
              <div style={{ display: "flex", gap: 6 }}>
                <div className="lp-social-btn" aria-label="Facebook"><Facebook size={14} /></div>
                <div className="lp-social-btn" aria-label="Twitter"><Twitter size={14} /></div>
                <div className="lp-social-btn" aria-label="Instagram"><Instagram size={14} /></div>
                <div className="lp-social-btn" aria-label="LinkedIn"><Linkedin size={14} /></div>
              </div>
            </div>

            {/* Product column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#FFFFFF", marginBottom: 1 }}>Product</div>
              <span className="lp-footer-link" onClick={() => scrollToId("intelligence")}>Features</span>
              <span className="lp-footer-link" onClick={() => scrollToId("how-it-works")}>How It Works</span>
              <span className="lp-footer-link" onClick={() => handleNav("signup")}>Sign Up</span>
              <span className="lp-footer-link" onClick={() => scrollToId("learners")}>Courses</span>
            </div>

            {/* For Users column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#FFFFFF", marginBottom: 1 }}>For Users</div>
              <span className="lp-footer-link" onClick={() => scrollToId("learners")}>Learner Dashboard</span>
              <span className="lp-footer-link" onClick={() => scrollToId("organisation")}>Instructor Workspace</span>
              <span className="lp-footer-link" onClick={() => scrollToId("learners")}>Community</span>
              <span className="lp-footer-link" onClick={() => scrollToId("how-it-works")}>Certificates</span>
            </div>

          </div>

          {/* Bottom Copyright & Legal Links */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, paddingTop: 16, borderTop: "1px solid #1E293B", fontSize: 11.5, color: "#64748B" }}>
            <div>
              © 2025 Train AI Ltd. All rights reserved. Headquartered in London, United Kingdom
            </div>
            <div style={{ display: "flex", gap: 14 }}>
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: "#0F172A", margin: 0 }}>Request a Live Demo</h3>
                <p style={{ fontSize: 12, color: "#64748B", margin: "2px 0 0" }}>Experience the workforce intelligence platform tailored to your team.</p>
              </div>
              <button style={styles.modalClose} onClick={() => setDemoModalOpen(false)} aria-label="Close">
                <X size={16} />
              </button>
            </div>

            {demoSubmitted ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 12, background: "#ECFDF5", color: "#059669", borderRadius: 8, fontWeight: 600, fontSize: 13 }}>
                <CheckCircle2 size={16} />
                <span>Thank you! We will reach out to schedule your demo shortly.</span>
              </div>
            ) : (
              <form onSubmit={handleDemoSubmit} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <input
                    required placeholder="Full name" value={demoName} onChange={(e) => setDemoName(e.target.value)}
                    style={styles.formInput}
                  />
                  <input
                    required placeholder="Company name" value={demoCompany} onChange={(e) => setDemoCompany(e.target.value)}
                    style={styles.formInput}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
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
                  {submitting ? "Submitting..." : "Schedule Live Demo"} <ArrowRight size={13} />
                </button>
                {demoError && <div style={{ fontSize: 11.5, color: "#EF4444", fontWeight: 600 }}>{demoError}</div>}
              </form>
            )}
          </div>
        </div>
      )}

      {/* Legal Content Modal */}
      {activeModal && (
        <div style={styles.modalOverlay} onClick={() => setActiveModal(null)} role="presentation">
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: 0 }}>{LEGAL_CONTENT[activeModal].title}</h3>
              <button style={styles.modalClose} onClick={() => setActiveModal(null)} aria-label="Close">
                <X size={15} />
              </button>
            </div>
            <p style={{ fontSize: 12.5, color: "#475569", lineHeight: 1.55, margin: 0 }}>{LEGAL_CONTENT[activeModal].body}</p>
          </div>
        </div>
      )}

    </div>
  );
}

const styles = {
  outer: { minHeight: "100vh", background: "#FFFFFF", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", overflowX: "hidden" },
  header: { background: "#FFFFFF", borderBottom: "1px solid #E2E8F0", position: "sticky", top: 0, zIndex: 60 },
  headerInner: { maxWidth: 1180, margin: "0 auto", padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" },
  signInBtn: { border: "none", background: "transparent", padding: "6px 10px", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "#334155" },
  requestDemoBtn: { padding: "6px 12px", borderRadius: 6, fontWeight: 600, fontSize: 12.5, cursor: "pointer" },
  getStartedBtn: { border: "none", padding: "6px 14px", borderRadius: 6, fontWeight: 700, fontSize: 12.5, cursor: "pointer" },
  startOrgBtn: { border: "none", padding: "10px 18px", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 },
  requestDemoOutlineBtn: { padding: "10px 18px", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer" },
  heroPill: { background: "#FFFFFF", border: "1px solid #E2E8F0", padding: "6px 10px", borderRadius: 8, display: "flex", alignItems: "center", gap: 8 },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 100 },
  modalCard: { background: "#FFFFFF", borderRadius: 8, padding: 20, maxWidth: 460, width: "100%", maxHeight: "85vh", overflowY: "auto", border: "1px solid #E2E8F0", boxShadow: "0 8px 30px rgba(15,23,42,0.2)" },
  modalClose: { border: "none", background: "#F1F5F9", borderRadius: 6, padding: 5, cursor: "pointer", display: "flex", color: "#64748B" },
  formInput: { width: "100%", border: "1px solid #E2E8F0", padding: "8px 10px", fontSize: 12, borderRadius: 6, outline: "none", boxSizing: "border-box", color: "#0F172A", background: "#FFFFFF" },
  formTextarea: { width: "100%", border: "1px solid #E2E8F0", padding: "8px 10px", fontSize: 12, borderRadius: 6, outline: "none", boxSizing: "border-box", color: "#0F172A", resize: "vertical", fontFamily: "inherit", background: "#FFFFFF" },
  modalSubmitBtn: { border: "none", padding: "10px 16px", borderRadius: 6, fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }
};
