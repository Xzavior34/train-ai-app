import React, { useState, useEffect } from "react";
import {
  ArrowRight, BookOpen, GraduationCap, ShieldCheck, CheckCircle2, X,
  Brain, Layers, ChevronDown, ClipboardList, UserPlus,
  Building2, Users, Target, TrendingUp, Lock, BarChart3,
  Zap, Flame, Menu, Check,
  Activity, Gauge, Database, Home, Mail, Download, Wifi,
  Accessibility, Bell, Facebook, Twitter, Instagram, Linkedin, Search,
  BarChart2, Heart, Award, Coins, FileText, Globe, Calendar, Clock
} from "lucide-react";
import { submitDemoRequest, captureAttributionFromURL } from "../../lib/api/waitlist.js";
import { trackReferralClickIfPresent } from "../../lib/api/organizations.js";

const TEAM_SIZE_OPTIONS = ["1–50", "51–200", "201–1,000", "1,000+"];
const ORG_TYPE_OPTIONS = [
  "Academy / Educational Institution",
  "NGO / Non-Profit / Foundation",
  "Business / Enterprise",
  "Independent Mentor / Instructor"
];

const LEGAL_CONTENT = {
  about: {
    title: "About Us",
    body: "Train AI is an institutional learning and capability platform serving academies, non-profit organizations, and modern businesses. We unite adaptive AI tutoring, structured cohort management, and verifiable skill telemetry in one unified system."
  },
  privacy: {
    title: "Privacy Policy",
    body: "Our Privacy Policy ensures your organization's data remains strictly confidential and isolated. We process minimal telemetry required to deliver adaptive pathways, track skills, and issue certified credentials. We never sell personal data or use proprietary institutional data to train public foundation models."
  },
  terms: {
    title: "Terms of Service",
    body: "Train AI terms govern organizational workspaces, role-based licensing, and institutional agreements. All accounts, certifications, and compliance logs are auditable under enterprise and non-profit SLAs. Questions: hello@trainailtd.com."
  },
  cookie: {
    title: "Cookie Policy",
    body: "We use strictly necessary session cookies to maintain secure authentication and role isolation. Optional analytics cookies remain disabled until explicit user consent is provided. Questions: hello@trainailtd.com."
  }
};

const SECTORS_DATA = {
  academies: {
    key: "academies",
    label: "Academies & Higher Ed",
    badge: "Higher Ed, Colleges & Bootcamps",
    icon: GraduationCap,
    title: "Empower faculty. Scale interactive AI curriculums.",
    desc: "Equip your instructors with automated quiz generation and cohort pacing while giving every enrolled student a 24/7 AI tutor and practical coding sandbox.",
    image: "https://images.unsplash.com/photo-1524178272502-390466be8e45?w=900&auto=format&fit=crop&q=80",
    features: [
      { title: "Cohort Pacing & Control", desc: "Organize students by semester, track assignment releases, and monitor milestone completions." },
      { title: "24/7 AI Teaching Assistant", desc: "Instant conceptual Q&A, code debugging, and adaptive practice tests for students." },
      { title: "Accredited Certifications", desc: "Issue tamper-proof certificates branded with your institution's seal and verification hashes." },
    ],
    pricingModel: "Tiered per-student or per-cohort term licensing with academic volume discounts up to 40%."
  },
  ngos: {
    key: "ngos",
    label: "NGOs & Social Impact",
    badge: "Non-Profits, Foundations & CSR",
    icon: Heart,
    title: "Bridge the digital divide with verified outcomes.",
    desc: "Deliver workforce-ready skills in underserved communities with low-bandwidth mobile access, sponsored cohorts, and transparent telemetry ready for grant reporting.",
    image: "https://images.unsplash.com/photo-1531545514256-b1400bc00f31?w=900&auto=format&fit=crop&q=80",
    features: [
      { title: "Grant & Donor Reporting", desc: "Export verified skill acquisition and completion metrics for donor transparency and board audits." },
      { title: "Low-Bandwidth Mobile Mode", desc: "Fast, reliable performance on modest smartphones and limited internet connections." },
      { title: "Sponsored Cohort Pools", desc: "Allocate subsidized seat blocks funded by philanthropic grants or corporate partnerships." },
    ],
    pricingModel: "Subsidized non-profit licensing, grant-funded sponsor tiers, and fee waivers for grassroots programs."
  },
  businesses: {
    key: "businesses",
    label: "Businesses & Enterprises",
    badge: "Corporate Teams & Growing Companies",
    icon: Building2,
    title: "Move beyond passive video clicks to verified capability.",
    desc: "Map your workforce capability in real time with AI skill graphs, identify team skill gaps before project deadlines, and deliver targeted upskilling tracks.",
    image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=900&auto=format&fit=crop&q=80",
    features: [
      { title: "Workforce Readiness Score", desc: "Single live capability metric per team, department, and company based on active tasks." },
      { title: "Dynamic AI Skill Graph", desc: "Topological map of verified talent, emerging skills, and critical organizational gaps." },
      { title: "Enterprise Security & SSO", desc: "Multi-tenant data isolation with PostgreSQL RLS, Okta/Azure SSO, and append-only audit logs." },
    ],
    pricingModel: "Flexible monthly or annual active seat licensing with pay-as-you-grow scaling and dedicated SLAs."
  }
};

const HOW_WE_BUILD_IT = [
  {
    icon: Target,
    title: "Readiness over completion",
    desc: "A finished course is not capability. We measure real comprehension, assessment scores, and practical execution."
  },
  {
    icon: Gauge,
    title: "Intelligence over reporting",
    desc: "Dashboards power proactive decisions, forecasting capability gaps before they impact outcomes."
  },
  {
    icon: Building2,
    title: "Multi-sector architecture",
    desc: "Engineered specifically for academies, non-profits, and enterprises with isolated tenant data."
  },
  {
    icon: Activity,
    title: "Every signal counts",
    desc: "Live assessments, instructor feedback, AI queries, and milestone completions enrich live capability."
  }
];

const TRUST_FEATURES = [
  {
    icon: Lock,
    title: "Secure tenant separation",
    desc: "Row-level policies keep every organization's learners, courses and results strictly isolated."
  },
  {
    icon: ClipboardList,
    title: "Audit logging",
    desc: "Administrative actions are recorded in an append-only trail for institutional and compliance review."
  },
  {
    icon: Download,
    title: "Export & grant reports",
    desc: "One-click CSV exports for grant reporting, academic records, and board presentations."
  },
  {
    icon: Wifi,
    title: "Low-bandwidth ready",
    desc: "Lightweight payload built for mobile-first access across emerging regions and campus networks."
  },
  {
    icon: Accessibility,
    title: "Accessible interface",
    desc: "High-contrast readability, keyboard navigation, and semantic structure across all screens."
  },
  {
    icon: Bell,
    title: "Reliable notifications",
    desc: "Session reminders, assignment alerts, and mentor nudges delivered by email and in-app."
  }
];

const FAQ_ITEMS = [
  {
    q: "Who is Train AI built for?",
    a: "Train AI is purpose-built for three key sectors: educational academies (universities, colleges, bootcamps), non-profit organizations & impact foundations (community upskilling, grant-backed initiatives), and businesses (enterprise capability and workforce upskilling)."
  },
  {
    q: "How does the payment and licensing structure work?",
    a: "We offer tailored structures for each sector: Academies receive term/semester licensing with academic discounts (up to 40% off); NGOs and Non-Profits receive subsidized grant-aligned rates or sponsored seat blocks; Businesses use flexible monthly or annual seat-based models with volume tiers."
  },
  {
    q: "How do academies use Train AI for their courses?",
    a: "Academies use Train AI as their digital cohort engine. Instructors schedule live sessions, curate custom curricula, set adaptive practice quizzes, and monitor student comprehension. Students get 24/7 AI tutor support for homework help and code debugging."
  },
  {
    q: "Can NGOs and non-profits use Train AI for grant reporting?",
    a: "Yes. Train AI includes dedicated impact telemetry. You can generate transparent, exportable reports detailing enrolled learners, modules completed, verified skills acquired, and employment readiness scores to present to donors and grant boards."
  },
  {
    q: "Does Train AI work on low-speed internet connections?",
    a: "Yes. The platform is engineered to be mobile-first and low-bandwidth friendly, ensuring learners in bandwidth-constrained regions or on mobile data plans can complete courses, quizzes, and discussions seamlessly."
  },
  {
    q: "How is Train AI different from a traditional LMS?",
    a: "Traditional LMS tools only track passive video clicks. Train AI actively measures real capability through an AI Skill Graph, continuous readiness scoring, automated adaptive quizzes, live cohort mentorship, and 24/7 personalized AI tutoring."
  },
  {
    q: "Are certificates officially branded with our organization's identity?",
    a: "Yes. Every academy, NGO, or enterprise can customize certificates with their official logo, custom signature, accreditation details, and cryptographic verification IDs."
  },
  {
    q: "Is our institutional data secure and private?",
    a: "Absolutely. Every organization operates inside a dedicated, isolated tenant protected by PostgreSQL Row-Level Security (RLS). Your curriculum and learner data are never used to train public foundation models."
  }
];

export default function LandingPage({ onNavigate }) {
  useEffect(() => { captureAttributionFromURL(); }, []);
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) trackReferralClickIfPresent(ref);
  }, []);

  const [activeSector, setActiveSector] = useState("academies"); // "academies" | "ngos" | "businesses"
  const [mobileLearnerTab, setMobileLearnerTab] = useState("home"); // "home" | "courses" | "ai" | "community"
  const [pollVoted, setPollVoted] = useState(false);
  const [selectedPollOption, setSelectedPollOption] = useState(0);

  const [demoName, setDemoName] = useState("");
  const [demoEmail, setDemoEmail] = useState("");
  const [demoCompany, setDemoCompany] = useState("");
  const [demoOrgType, setDemoOrgType] = useState(ORG_TYPE_OPTIONS[0]);
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
        companyName: `[${demoOrgType}] ${demoCompany}`,
        teamSize: demoTeamSize,
        message: demoMessage,
        source: `landing_page_${activeSector}`,
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

  function handleNav(target, data) {
    setMobileMenuOpen(false);
    if (["about", "privacy", "terms", "cookie"].includes(target)) {
      setActiveModal(target);
      return;
    }
    if (["sectors", "pricing", "intelligence", "learners", "organisation", "faq", "how-it-works", "trust"].includes(target)) {
      scrollToId(target);
      return;
    }
    if (target === "demo" || target === "book-demo") {
      if (typeof onNavigate === "function") {
        onNavigate("book-demo", { sector: activeSector, ...data });
      } else {
        setDemoModalOpen(true);
      }
      return;
    }
    if (typeof onNavigate === "function") {
      onNavigate(target);
    }
  }

  const currentSector = SECTORS_DATA[activeSector] || SECTORS_DATA.academies;

  return (
    <div style={styles.outer}>
      <style>{`
        .lp-card-hover {
          transition: border-color .15s ease, box-shadow .15s ease, transform .15s ease;
        }
        .lp-card-hover:hover {
          border-color: #94A3B8 !important;
          box-shadow: 0 6px 20px -2px rgba(15, 23, 42, 0.08);
          transform: translateY(-2px);
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

        .action-btn-primary {
          background: #2563EB;
          color: #FFFFFF;
          transition: background-color .14s ease, transform .14s ease;
          cursor: pointer;
        }
        .action-btn-primary:hover {
          background: #1D4ED8;
        }
        .action-btn-primary:active {
          transform: scale(.98);
        }

        .action-btn-outline {
          background: #FFFFFF;
          color: #0F172A;
          border: 1px solid #CBD5E1;
          transition: background-color .14s ease, border-color .14s ease;
          cursor: pointer;
        }
        .action-btn-outline:hover {
          background: #F8FAFC;
          border-color: #94A3B8;
        }

        /* Sector Tab Switcher */
        .sector-tab-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          border-radius: 8px;
          font-size: 13.5px;
          font-weight: 700;
          border: 1.5px solid transparent;
          background: transparent;
          color: #64748B;
          cursor: pointer;
          transition: all 0.18s ease;
        }
        .sector-tab-btn:hover {
          color: #0F172A;
          background: rgba(15, 23, 42, 0.04);
        }
        .sector-tab-btn.active {
          background: #FFFFFF;
          color: #2563EB;
          border-color: #CBD5E1;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
        }

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
        .lp-bg-hero { background-color: #FFFFFF; }
        .lp-bg-surface-1 {
          background-color: #F8FAFC;
          border-top: 1px solid #E2E8F0;
          border-bottom: 1px solid #E2E8F0;
        }
        .lp-bg-surface-2 { background-color: #FFFFFF; }
        .lp-bg-surface-tint {
          background-color: #F1F5F9;
          border-top: 1px solid #E2E8F0;
          border-bottom: 1px solid #E2E8F0;
        }

        /* Responsive layout */
        @media (max-width: 960px) {
          .lp-desktop-nav { display: none !important; }
          .lp-mobile-menu-btn { display: flex !important; }
          .lp-hero-grid { grid-template-columns: 1fr !important; gap: 36px !important; text-align: center !important; }
          .lp-hero-left { margin: 0 auto !important; max-width: 600px !important; }
          .lp-hero-ctas { justify-content: center !important; }
          .lp-hero-right { justify-content: center !important; }
          .lp-learner-grid { grid-template-columns: 1fr !important; gap: 24px !important; }
          .sector-detail-grid { grid-template-columns: 1fr !important; gap: 24px !important; }
        }
        @media (min-width: 961px) {
          .lp-mobile-drawer { display: none !important; }
          .lp-mobile-menu-btn { display: none !important; }
        }
        @media (max-width: 640px) {
          .lp-hero-h1 { font-size: 32px !important; line-height: 1.15 !important; }
          .lp-section-h2 { font-size: 23px !important; line-height: 1.2 !important; }
          .lp-section-inner { padding: 34px 16px !important; }
          .lp-hero-ctas { flex-direction: column !important; width: 100% !important; }
          .lp-hero-ctas > button { width: 100% !important; justify-content: center !important; }
          .sector-tabs-container { flex-direction: column !important; width: 100% !important; }
          .sector-tab-btn { width: 100% !important; justify-content: center !important; }
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
          <nav className="lp-desktop-nav" style={{ display: "flex", gap: 22, alignItems: "center" }}>
            <span className="lp-nav-link" onClick={() => scrollToId("sectors")}>Solutions</span>
            <span className="lp-nav-link" onClick={() => scrollToId("pricing")}>Partnerships &amp; Pricing</span>
            <span className="lp-nav-link" onClick={() => scrollToId("intelligence")}>Platform</span>
            <span className="lp-nav-link" onClick={() => scrollToId("learners")}>Learner App</span>
            <span className="lp-nav-link" onClick={() => scrollToId("faq")}>FAQ</span>
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
              onClick={() => handleNav("book-demo")}
            >
              Book a Demo
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
                width: 36, height: 36, borderRadius: 8, border: "1.5px solid #CBD5E1",
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
          <div
            className="lp-mobile-drawer anim-fluid-entrance"
            style={{
              background: "#FFFFFF",
              borderTop: "1px solid #E2E8F0",
              padding: "16px 20px 24px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              boxShadow: "0 16px 40px -10px rgba(15, 23, 42, 0.12)"
            }}
          >
            <span className="lp-nav-link" style={{ fontSize: 14, fontWeight: 700 }} onClick={() => scrollToId("sectors")}>Sector Solutions</span>
            <span className="lp-nav-link" style={{ fontSize: 14, fontWeight: 700 }} onClick={() => scrollToId("pricing")}>Partnerships &amp; Pricing</span>
            <span className="lp-nav-link" style={{ fontSize: 14, fontWeight: 700 }} onClick={() => scrollToId("intelligence")}>Platform Architecture</span>
            <span className="lp-nav-link" style={{ fontSize: 14, fontWeight: 700 }} onClick={() => scrollToId("learners")}>Learner App</span>
            <span className="lp-nav-link" style={{ fontSize: 14, fontWeight: 700 }} onClick={() => scrollToId("faq")}>FAQ</span>
            <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                className="action-btn-outline"
                style={{ width: "100%", padding: "10px", borderRadius: 8, fontWeight: 700, fontSize: 13 }}
                onClick={() => handleNav("signin")}
              >
                Sign In
              </button>
              <button
                className="action-btn-primary"
                style={{ width: "100%", padding: "10px", borderRadius: 8, fontWeight: 700, fontSize: 13 }}
                onClick={() => handleNav("book-demo")}
              >
                Book a Demo
              </button>
            </div>
          </div>
        )}
      </header>

      {/* =========================================================================
          SECTION 1: HERO SECTION
          ========================================================================= */}
      <section className="lp-bg-hero" style={{ width: "100%", position: "relative", borderBottom: "1px solid #E2E8F0" }}>
        <div className="lp-section-inner" style={{ maxWidth: 1180, margin: "0 auto", padding: "48px 20px 64px" }}>
          <div className="lp-hero-grid" style={{ display: "grid", gridTemplateColumns: "1.08fr 0.92fr", gap: 36, alignItems: "center" }}>
            
            {/* Left Column */}
            <div className="lp-hero-left" style={{ textAlign: "left" }}>
              
              {/* Eyebrow */}
              <div style={{
                fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em",
                color: "#2563EB", marginBottom: 12, display: "inline-flex", alignItems: "center", gap: 6
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#2563EB" }} />
                AI Learning &amp; Capability Platform
              </div>

              {/* Headline */}
              <h1 className="lp-hero-h1" style={{ fontSize: "clamp(34px, 4.2vw, 54px)", fontWeight: 900, letterSpacing: "-0.035em", color: "#0F172A", margin: "0 0 16px", lineHeight: 1.1 }}>
                Empowering academies,<br />
                NGOs, and businesses<br />
                <span style={{ color: "#2563EB" }}>to build real skills.</span>
              </h1>

              {/* Subtitle */}
              <p style={{ fontSize: 15, color: "#475569", lineHeight: 1.55, margin: "0 0 22px", maxWidth: 510 }}>
                Train AI unites adaptive AI tutoring, live cohort mentorship, and real-time skill telemetry in one platform — purpose-built for academic institutions, social impact programs, and forward-thinking enterprises.
              </p>

              {/* Dual CTAs */}
              <div className="lp-hero-ctas" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
                <button className="action-btn-primary" style={styles.startOrgBtn} onClick={() => handleNav("signin")}>
                  Start with your organization <ArrowRight size={14} />
                </button>
                <button className="action-btn-outline" style={styles.requestDemoOutlineBtn} onClick={() => handleNav("book-demo")}>
                  Book a Demo
                </button>
              </div>

              {/* Sector Pills */}
              <div style={{ display: "flex", gap: 14, alignItems: "center", borderTop: "1px solid #E2E8F0", paddingTop: 18, marginTop: 4, flexWrap: "wrap" }}>
                <div style={{ cursor: "pointer" }} onClick={() => { setActiveSector("academies"); scrollToId("sectors"); }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A", display: "flex", alignItems: "center", gap: 5 }}>
                    <GraduationCap size={15} color="#2563EB" /> Academies
                  </div>
                  <div style={{ fontSize: 11.5, color: "#64748B" }}>Cohort curriculum delivery</div>
                </div>
                <div style={{ width: 1, height: 26, background: "#E2E8F0" }} />
                <div style={{ cursor: "pointer" }} onClick={() => { setActiveSector("ngos"); scrollToId("sectors"); }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A", display: "flex", alignItems: "center", gap: 5 }}>
                    <Heart size={15} color="#E11D48" /> NGOs &amp; Impact
                  </div>
                  <div style={{ fontSize: 11.5, color: "#64748B" }}>Grant &amp; community telemetry</div>
                </div>
                <div style={{ width: 1, height: 26, background: "#E2E8F0" }} />
                <div style={{ cursor: "pointer" }} onClick={() => { setActiveSector("businesses"); scrollToId("sectors"); }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A", display: "flex", alignItems: "center", gap: 5 }}>
                    <Building2 size={15} color="#2563EB" /> Enterprises
                  </div>
                  <div style={{ fontSize: 11.5, color: "#64748B" }}>Workforce skill graphs</div>
                </div>
              </div>

            </div>

            {/* Right Column: Editorial Multi-Image Composition */}
            <div className="lp-hero-right" style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
              
              {/* Asymmetric Imagery Duo */}
              <div style={{ position: "relative", width: "100%", maxWidth: 440, minHeight: 330 }}>
                {/* Image 1: Academy & Classroom setting */}
                <div style={{ width: "72%", borderRadius: 10, overflow: "hidden", border: "1px solid #CBD5E1", boxShadow: "0 10px 28px rgba(15,23,42,0.08)" }}>
                  <img
                    src="https://images.unsplash.com/photo-1524178272502-390466be8e45?w=800&auto=format&fit=crop&q=80"
                    alt="Active Academy Cohort"
                    style={{ width: "100%", height: 210, objectFit: "cover", display: "block" }}
                  />
                  <div style={{ background: "#FFFFFF", padding: "8px 12px", borderTop: "1px solid #E2E8F0", textAlign: "left" }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: "#2563EB", textTransform: "uppercase" }}>Academies &amp; Bootcamps</span>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>Structured cohort learning with 24/7 AI tutor</div>
                  </div>
                </div>

                {/* Image 2: NGO & Community Tech Session */}
                <div style={{ position: "absolute", right: 0, bottom: 10, width: "62%", borderRadius: 10, overflow: "hidden", border: "1px solid #CBD5E1", boxShadow: "0 14px 34px rgba(15,23,42,0.12)" }}>
                  <img
                    src="https://images.unsplash.com/photo-1531545514256-b1400bc00f31?w=800&auto=format&fit=crop&q=80"
                    alt="Community Impact Workshop"
                    style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }}
                  />
                  <div style={{ background: "#0F172A", padding: "8px 12px", color: "#FFFFFF", textAlign: "left" }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: "#34D399", textTransform: "uppercase" }}>Social Impact &amp; Grants</span>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#FFFFFF" }}>Subsidized programs with verified outcomes</div>
                  </div>
                </div>
              </div>

              {/* Verified Sector Telemetry Floating Pill */}
              <div style={{
                marginTop: 18, width: "100%", maxWidth: 440,
                background: "#FFFFFF", borderRadius: 8, padding: "10px 14px",
                border: "1px solid #CBD5E1", boxShadow: "0 4px 16px rgba(15,23,42,0.06)",
                display: "flex", justifyContent: "space-between", alignItems: "center", boxSizing: "border-box"
              }}>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: 15, fontWeight: 900, color: "#0F172A" }}>94%</div>
                  <div style={{ fontSize: 10.5, color: "#64748B", fontWeight: 600 }}>Cohort completion</div>
                </div>
                <div style={{ width: 1, height: 22, background: "#E2E8F0" }} />
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: 15, fontWeight: 900, color: "#2563EB" }}>1,400+</div>
                  <div style={{ fontSize: 10.5, color: "#64748B", fontWeight: 600 }}>Impact learners certified</div>
                </div>
                <div style={{ width: 1, height: 22, background: "#E2E8F0" }} />
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: 15, fontWeight: 900, color: "#16A34A" }}>Real-time</div>
                  <div style={{ fontSize: 10.5, color: "#64748B", fontWeight: 600 }}>Grant &amp; skill telemetry</div>
                </div>
              </div>

            </div>

          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 2: SECTOR SOLUTIONS (ACADEMIES, NGOS, BUSINESSES)
          ========================================================================= */}
      <section id="sectors" className="lp-bg-surface-1" style={{ width: "100%" }}>
        <div className="lp-section-inner" style={{ maxWidth: 1180, margin: "0 auto", padding: "48px 20px 60px", textAlign: "left" }}>
          
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#2563EB", letterSpacing: ".06em" }}>SOLUTIONS BY SECTOR</span>
            <h2 className="lp-section-h2" style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.03em", color: "#0F172A", margin: "6px 0 8px" }}>
              Built for your specific mission
            </h2>
            <p style={{ fontSize: 14.5, color: "#64748B", maxWidth: 620, margin: "0 auto" }}>
              Select your organization type to see how Train AI adapts to your curriculum, community, or company.
            </p>
          </div>

          {/* Interactive Sector Switcher Controls */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
            <div className="sector-tabs-container" style={{
              display: "inline-flex", background: "#F1F5F9", padding: 4, borderRadius: 10, border: "1px solid #E2E8F0", gap: 4
            }}>
              {Object.values(SECTORS_DATA).map(sector => {
                const Icon = sector.icon;
                const isActive = activeSector === sector.key;
                return (
                  <button
                    key={sector.key}
                    type="button"
                    className={`sector-tab-btn ${isActive ? "active" : ""}`}
                    onClick={() => setActiveSector(sector.key)}
                  >
                    <Icon size={16} color={isActive ? "#2563EB" : "#64748B"} />
                    <span>{sector.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dynamic Sector Deep-Dive Card */}
          <div style={{
            background: "#FFFFFF", borderRadius: 12, border: "1px solid #CBD5E1",
            padding: "clamp(24px, 3vw, 36px)", boxShadow: "0 8px 24px -4px rgba(15, 23, 42, 0.06)"
          }}>
            <div className="sector-detail-grid" style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 36, alignItems: "center" }}>
              
              {/* Left Content */}
              <div>
                <span style={{
                  fontSize: 10.5, fontWeight: 800, color: "#2563EB", background: "#EFF6FF",
                  padding: "3px 8px", borderRadius: 6, display: "inline-block", marginBottom: 12
                }}>
                  {currentSector.badge}
                </span>

                <h3 style={{ fontSize: "clamp(22px, 2.5vw, 28px)", fontWeight: 900, color: "#0F172A", margin: "0 0 10px", lineHeight: 1.25 }}>
                  {currentSector.title}
                </h3>

                <p style={{ fontSize: 14.5, color: "#475569", lineHeight: 1.55, margin: "0 0 20px" }}>
                  {currentSector.desc}
                </p>

                {/* 3 Capabilities */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
                  {currentSector.features.map(f => (
                    <div key={f.title} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <div style={{ width: 22, height: 22, borderRadius: 6, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                        <Check size={13} color="#2563EB" strokeWidth={2.5} />
                      </div>
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 800, color: "#0F172A" }}>{f.title}</div>
                        <div style={{ fontSize: 12.5, color: "#64748B", lineHeight: 1.4 }}>{f.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Sector Payment / Partnership Note */}
                <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, padding: "10px 14px", marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#0F172A", marginBottom: 2 }}>PRICING &amp; PARTNERSHIP STRUCTURE</div>
                  <div style={{ fontSize: 12.5, color: "#475569" }}>{currentSector.pricingModel}</div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button className="action-btn-primary" style={{ padding: "10px 18px", borderRadius: 8, fontWeight: 700, fontSize: 13 }} onClick={() => handleNav("book-demo", { sector: activeSector })}>
                    Book a {currentSector.label.split(" ")[0]} Demo
                  </button>
                  <button className="action-btn-outline" style={{ padding: "10px 16px", borderRadius: 8, fontWeight: 600, fontSize: 13 }} onClick={() => scrollToId("pricing")}>
                    View pricing options
                  </button>
                </div>
              </div>

              {/* Right Photo */}
              <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid #CBD5E1" }}>
                <img
                  src={currentSector.image}
                  alt={currentSector.label}
                  style={{ width: "100%", height: 320, objectFit: "cover", display: "block" }}
                />
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* =========================================================================
          SECTION 3: PARTNERSHIP & PRICING MODELS
          ========================================================================= */}
      <section id="pricing" className="lp-bg-surface-2" style={{ width: "100%" }}>
        <div className="lp-section-inner" style={{ maxWidth: 1180, margin: "0 auto", padding: "50px 20px 64px", textAlign: "left" }}>
          
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#2563EB", letterSpacing: ".06em" }}>TRANSPARENT LICENSING</span>
            <h2 className="lp-section-h2" style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.03em", color: "#0F172A", margin: "6px 0 8px" }}>
              Tailored partnership &amp; pricing structures
            </h2>
            <p style={{ fontSize: 14.5, color: "#64748B", maxWidth: 640, margin: "0 auto" }}>
              Whether you are an accredited academy, a grant-funded non-profit, or a scaling tech company, our licensing adapts to your operating model.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
            
            {/* Model 1: Academies */}
            <div className="lp-card-hover" style={{ background: "#FFFFFF", borderRadius: 10, border: "1.5px solid #CBD5E1", padding: "26px 22px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#2563EB", background: "#EFF6FF", padding: "3px 8px", borderRadius: 6 }}>
                    ACADEMIC LICENSING
                  </span>
                  <GraduationCap size={18} color="#2563EB" />
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 900, color: "#0F172A", margin: "0 0 4px" }}>Institutional Cohort</h3>
                <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 16px", lineHeight: 1.45 }}>
                  Term and semester licensing built for colleges, bootcamps, and technical schools.
                </p>

                <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: 14, marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#0F172A", marginBottom: 8 }}>WHAT'S INCLUDED:</div>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 7, fontSize: 12.5, color: "#334155" }}>
                    <li style={{ display: "flex", gap: 6 }}><Check size={14} color="#2563EB" style={{ flexShrink: 0, marginTop: 2 }} /> <span>Per-student semester or annual licensing</span></li>
                    <li style={{ display: "flex", gap: 6 }}><Check size={14} color="#2563EB" style={{ flexShrink: 0, marginTop: 2 }} /> <span>Faculty cohort management &amp; pacing controls</span></li>
                    <li style={{ display: "flex", gap: 6 }}><Check size={14} color="#2563EB" style={{ flexShrink: 0, marginTop: 2 }} /> <span>24/7 AI tutor &amp; automated adaptive quizzes</span></li>
                    <li style={{ display: "flex", gap: 6 }}><Check size={14} color="#2563EB" style={{ flexShrink: 0, marginTop: 2 }} /> <span>Academic discount volume rates (up to 40% off)</span></li>
                    <li style={{ display: "flex", gap: 6 }}><Check size={14} color="#2563EB" style={{ flexShrink: 0, marginTop: 2 }} /> <span>Institutional seal branding &amp; credentials</span></li>
                  </ul>
                </div>
              </div>

              <button className="action-btn-outline" style={{ width: "100%", padding: "10px", borderRadius: 8, fontWeight: 700, fontSize: 13, textAlign: "center" }} onClick={() => handleNav("book-demo", { sector: "academies" })}>
                Book Academic Consultation
              </button>
            </div>

            {/* Model 2: NGOs & Impact */}
            <div className="lp-card-hover" style={{ background: "#FFFFFF", borderRadius: 10, border: "2px solid #2563EB", padding: "26px 22px", display: "flex", flexDirection: "column", justifyContent: "space-between", position: "relative" }}>
              <div style={{ position: "absolute", top: -11, right: 18, background: "#2563EB", color: "#FFFFFF", fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 999, textTransform: "uppercase" }}>
                COMMUNITY IMPACT
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#E11D48", background: "#FFE4E6", padding: "3px 8px", borderRadius: 6 }}>
                    GRANT &amp; IMPACT SUBSIDIES
                  </span>
                  <Heart size={18} color="#E11D48" />
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 900, color: "#0F172A", margin: "0 0 4px" }}>Sponsored Programs</h3>
                <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 16px", lineHeight: 1.45 }}>
                  Subsidized access for non-profits, philanthropic foundations, and community upskilling.
                </p>

                <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: 14, marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#0F172A", marginBottom: 8 }}>WHAT'S INCLUDED:</div>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 7, fontSize: 12.5, color: "#334155" }}>
                    <li style={{ display: "flex", gap: 6 }}><Check size={14} color="#16A34A" style={{ flexShrink: 0, marginTop: 2 }} /> <span>Subsidized pricing &amp; donor-matched grant seats</span></li>
                    <li style={{ display: "flex", gap: 6 }}><Check size={14} color="#16A34A" style={{ flexShrink: 0, marginTop: 2 }} /> <span>Exportable impact telemetry for donor reporting</span></li>
                    <li style={{ display: "flex", gap: 6 }}><Check size={14} color="#16A34A" style={{ flexShrink: 0, marginTop: 2 }} /> <span>Low-bandwidth mobile delivery for emerging regions</span></li>
                    <li style={{ display: "flex", gap: 6 }}><Check size={14} color="#16A34A" style={{ flexShrink: 0, marginTop: 2 }} /> <span>Dedicated community cohort facilitator onboarding</span></li>
                    <li style={{ display: "flex", gap: 6 }}><Check size={14} color="#16A34A" style={{ flexShrink: 0, marginTop: 2 }} /> <span>Full curriculum catalog &amp; career pathways</span></li>
                  </ul>
                </div>
              </div>

              <button className="action-btn-primary" style={{ width: "100%", padding: "10px", borderRadius: 8, fontWeight: 700, fontSize: 13, textAlign: "center" }} onClick={() => handleNav("book-demo", { sector: "ngos" })}>
                Book Grant Consultation
              </button>
            </div>

            {/* Model 3: Businesses */}
            <div className="lp-card-hover" style={{ background: "#FFFFFF", borderRadius: 10, border: "1.5px solid #CBD5E1", padding: "26px 22px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#0F172A", background: "#F1F5F9", padding: "3px 8px", borderRadius: 6 }}>
                    ENTERPRISE SCALE
                  </span>
                  <Building2 size={18} color="#0F172A" />
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 900, color: "#0F172A", margin: "0 0 4px" }}>Workforce Intelligence</h3>
                <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 16px", lineHeight: 1.45 }}>
                  Scalable seat-based licensing for corporate talent mapping and compliance.
                </p>

                <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: 14, marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#0F172A", marginBottom: 8 }}>WHAT'S INCLUDED:</div>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 7, fontSize: 12.5, color: "#334155" }}>
                    <li style={{ display: "flex", gap: 6 }}><Check size={14} color="#2563EB" style={{ flexShrink: 0, marginTop: 2 }} /> <span>Active seat licensing (monthly or annual billing)</span></li>
                    <li style={{ display: "flex", gap: 6 }}><Check size={14} color="#2563EB" style={{ flexShrink: 0, marginTop: 2 }} /> <span>Full Workforce Intelligence &amp; live AI Skill Graph</span></li>
                    <li style={{ display: "flex", gap: 6 }}><Check size={14} color="#2563EB" style={{ flexShrink: 0, marginTop: 2 }} /> <span>SSO (SAML, Okta, Azure AD) &amp; tenant isolation</span></li>
                    <li style={{ display: "flex", gap: 6 }}><Check size={14} color="#2563EB" style={{ flexShrink: 0, marginTop: 2 }} /> <span>Compliance tracking &amp; audit export logs</span></li>
                    <li style={{ display: "flex", gap: 6 }}><Check size={14} color="#2563EB" style={{ flexShrink: 0, marginTop: 2 }} /> <span>Priority SLA &amp; dedicated customer success</span></li>
                  </ul>
                </div>
              </div>

              <button className="action-btn-outline" style={{ width: "100%", padding: "10px", borderRadius: 8, fontWeight: 700, fontSize: 13, textAlign: "center" }} onClick={() => handleNav("signin")}>
                Start Business Trial
              </button>
            </div>

          </div>

        </div>
      </section>

      {/* =========================================================================
          SECTION 4: THE INTELLIGENCE & TELEMETRY LAYER
          ========================================================================= */}
      <section id="intelligence" className="lp-bg-surface-1" style={{ width: "100%" }}>
        <div className="lp-section-inner" style={{ maxWidth: 1180, margin: "0 auto", padding: "48px 20px 58px", textAlign: "left" }}>
          
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#2563EB", letterSpacing: ".06em" }}>THE INTELLIGENCE LAYER</span>
          </div>

          <h2 className="lp-section-h2" style={{ fontSize: 30, fontWeight: 900, letterSpacing: "-0.03em", color: "#0F172A", margin: "0 0 8px" }}>
            Understand capability in real time
          </h2>

          <p style={{ fontSize: 14.5, color: "#64748B", maxWidth: 620, margin: "0 0 28px", lineHeight: 1.5 }}>
            Whether managing university cohorts, community upskilling cohorts, or corporate teams, the intelligence layer combines active signals into decisions you can act on.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            
            <div className="lp-card-hover" style={{ background: "#FFFFFF", padding: "20px 20px", borderRadius: 10, border: "1px solid #E2E8F0" }}>
              <div style={{ width: 34, height: 34, borderRadius: 6, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                <Brain size={18} color="#2563EB" />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: "0 0 6px" }}>Dynamic Skill Graph</h3>
              <p style={{ fontSize: 13, color: "#64748B", margin: 0, lineHeight: 1.5 }}>
                A live view of skill coverage across learners, classes, or departments: what skills exist, what is developing, and where critical gaps remain.
              </p>
            </div>

            <div className="lp-card-hover" style={{ background: "#FFFFFF", padding: "20px 20px", borderRadius: 10, border: "1px solid #E2E8F0" }}>
              <div style={{ width: 34, height: 34, borderRadius: 6, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                <Gauge size={18} color="#2563EB" />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: "0 0 6px" }}>Readiness &amp; Impact Index</h3>
              <p style={{ fontSize: 13, color: "#64748B", margin: 0, lineHeight: 1.5 }}>
                A unified execution indicator per cohort, function, or grant initiative, answering who is ready to execute and who needs immediate mentorship.
              </p>
            </div>

            <div className="lp-card-hover" style={{ background: "#FFFFFF", padding: "20px 20px", borderRadius: 10, border: "1px solid #E2E8F0" }}>
              <div style={{ width: 34, height: 34, borderRadius: 6, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                <BarChart3 size={18} color="#2563EB" />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: "0 0 6px" }}>Actionable Telemetry</h3>
              <p style={{ fontSize: 13, color: "#64748B", margin: 0, lineHeight: 1.5 }}>
                Summary dashboards built for leaders, academic deans, and NGO directors: exportable talent metrics, velocity trends, and audit records.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* =========================================================================
          SECTION 5: THE LEARNER APP (INTERACTIVE DEMO)
          ========================================================================= */}
      <section id="learners" className="lp-bg-surface-tint" style={{ width: "100%" }}>
        <div className="lp-section-inner" style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 20px 52px" }}>
          
          <div style={{ textAlign: "left", marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#2563EB", letterSpacing: ".06em" }}>THE LEARNER EXPERIENCE</span>
          </div>

          <h2 className="lp-section-h2" style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.03em", color: "#0F172A", margin: "0 0 6px", textAlign: "left" }}>
            Four focused spaces. Zero clutter.
          </h2>

          <p style={{ fontSize: 14, color: "#64748B", maxWidth: 620, margin: "0 0 20px", lineHeight: 1.5, textAlign: "left" }}>
            Every learner gets a dedicated workspace: Home, Courses, AI Coach, and Community. Tap the tabs or phone buttons to preview live.
          </p>

          <div className="lp-learner-grid" style={{ display: "grid", gridTemplateColumns: "1.25fr 0.75fr", gap: 20, alignItems: "stretch" }}>
            
            {/* Left Side: Interactive Tab Stack */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, justifyContent: "space-between" }}>
              
              {/* Tab 1: Home */}
              <div
                className="lp-card-hover"
                onClick={() => setMobileLearnerTab("home")}
                style={{
                  background: mobileLearnerTab === "home" ? "#EFF6FF" : "#FFFFFF",
                  padding: "12px 14px", borderRadius: 8,
                  border: mobileLearnerTab === "home" ? "2px solid #2563EB" : "1px solid #E2E8F0",
                  cursor: "pointer"
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
                    {mobileLearnerTab === "home" ? "Active" : "Personalized"}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: "#64748B", margin: "2px 0 0", lineHeight: 1.4 }}>
                  Sprint milestones, career roadmap, active cohorts, and daily study streaks.
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
                  cursor: "pointer"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 24, height: 24, borderRadius: 6, background: mobileLearnerTab === "courses" ? "#2563EB" : "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", color: mobileLearnerTab === "courses" ? "#fff" : "#2563EB" }}>
                      <BookOpen size={13} />
                    </div>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", margin: 0 }}>Curriculum &amp; Masterclasses</h3>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: mobileLearnerTab === "courses" ? "#2563EB" : "#64748B", background: mobileLearnerTab === "courses" ? "rgba(37,99,235,0.12)" : "#F1F5F9", padding: "1px 6px", borderRadius: 4 }}>
                    {mobileLearnerTab === "courses" ? "Active" : "Catalog"}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: "#64748B", margin: "2px 0 0", lineHeight: 1.4 }}>
                  Technical courses, assigned cohort modules, video previews, and practice assignments.
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
                  cursor: "pointer"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 24, height: 24, borderRadius: 6, background: mobileLearnerTab === "ai" ? "#2563EB" : "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", color: mobileLearnerTab === "ai" ? "#fff" : "#2563EB" }}>
                      <Zap size={13} />
                    </div>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", margin: 0 }}>24/7 AI Tutor &amp; Quiz Arena</h3>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: mobileLearnerTab === "ai" ? "#2563EB" : "#64748B", background: mobileLearnerTab === "ai" ? "rgba(37,99,235,0.12)" : "#F1F5F9", padding: "1px 6px", borderRadius: 4 }}>
                    {mobileLearnerTab === "ai" ? "Active" : "Adaptive"}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: "#64748B", margin: "2px 0 0", lineHeight: 1.4 }}>
                  Interactive code debugging assistant and real-time adaptive practice quizzes.
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
                  cursor: "pointer"
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
                    {mobileLearnerTab === "community" ? "Active" : "Peer Network"}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: "#64748B", margin: "2px 0 0", lineHeight: 1.4 }}>
                  Pinned announcements, peer Q&amp;A discussions, study groups, and live voting polls.
                </p>
              </div>

              {/* Bottom Feature Badges */}
              <div style={{ background: "#FFFFFF", borderRadius: 8, padding: "8px 12px", border: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "#334155" }}>
                  <Flame size={12} color="#EA580C" /> Daily Streaks
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "#334155" }}>
                  <Target size={12} color="#2563EB" /> Adaptive Quizzes
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "#334155" }}>
                  <CheckCircle2 size={12} color="#16A34A" /> Micro-Credentials
                </span>
              </div>

            </div>

            {/* Right Side: Proportional Phone Preview */}
            <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
              <div style={{
                width: 270, height: 475, background: "#0F172A", borderRadius: 12,
                padding: 6, border: "2px solid #334155", position: "relative",
                display: "flex", flexDirection: "column", boxSizing: "border-box"
              }}>
                <div style={{
                  flex: 1, background: "#F8FAFC", borderRadius: 10, overflow: "hidden",
                  display: "flex", flexDirection: "column", position: "relative"
                }}>
                  {/* Top Bar */}
                  <div style={{ padding: "8px 10px 6px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#FFFFFF", borderBottom: "1px solid #F1F5F9" }}>
                    <img src="/train-ai-logo.png" alt="TRAIN.AI" style={{ height: 14, width: "auto" }} />
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 2, background: "#FFF7ED", padding: "1px 5px", borderRadius: 4, fontSize: 8.5, fontWeight: 700, color: "#EA580C" }}>
                        <Flame size={9} color="#EA580C" /> 3
                      </div>
                      <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#2563EB", color: "#fff", fontSize: 8.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        A
                      </div>
                    </div>
                  </div>

                  {/* Body */}
                  <div style={{ flex: 1, overflowY: "auto", padding: "8px", textAlign: "left" }}>
                    {mobileLearnerTab === "home" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ background: "#0F172A", borderRadius: 8, padding: "9px 10px", color: "#FFFFFF" }}>
                          <div style={{ fontSize: 10, color: "#94A3B8" }}>Welcome back,</div>
                          <div style={{ fontSize: 12, fontWeight: 800 }}>Alex</div>
                          <div style={{ fontSize: 8.5, color: "#94A3B8", marginTop: 2 }}>
                            Active cohort: <span style={{ color: "#60A5FA", fontWeight: 600 }}>AI &amp; Data Cohort #4</span>
                          </div>
                          <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 6, padding: "4px 6px", marginTop: 6, border: "1px solid rgba(255,255,255,0.1)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 8, fontWeight: 700, marginBottom: 2 }}>
                              <span style={{ color: "#E2E8F0" }}>Milestone Progress</span>
                              <span style={{ color: "#34D399" }}>75% Ready</span>
                            </div>
                            <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.15)", overflow: "hidden" }}>
                              <div style={{ width: "75%", height: "100%", background: "#34D399", borderRadius: 2 }} />
                            </div>
                          </div>
                        </div>

                        <div style={{ background: "#FFFFFF", borderRadius: 8, border: "1px solid #E2E8F0", padding: "7px" }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "#0F172A" }}>Today's Session</div>
                          <div style={{ fontSize: 8, color: "#64748B" }}>Prompt Engineering Lab • 4:00 PM GMT</div>
                        </div>
                      </div>
                    )}

                    {mobileLearnerTab === "courses" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ background: "#0F172A", borderRadius: 8, padding: "8px 9px", color: "#FFFFFF" }}>
                          <div style={{ fontSize: 7.5, fontWeight: 700, color: "#C7D2FE", background: "rgba(255,255,255,0.1)", padding: "1px 4px", borderRadius: 3, display: "inline-block" }}>
                            CURRICULUM
                          </div>
                          <div style={{ fontSize: 10.5, fontWeight: 800, marginTop: 3 }}>
                            Full-Stack AI Application Engineering
                          </div>
                          <div style={{ fontSize: 8, color: "#CBD5E1", marginTop: 1 }}>
                            8 modules • 14 practical labs • Accredited
                          </div>
                        </div>

                        <div style={{ background: "#FFFFFF", borderRadius: 8, border: "1px solid #E2E8F0", padding: "5px 7px", display: "flex", gap: 5, alignItems: "center" }}>
                          <div style={{ width: 22, height: 22, borderRadius: 4, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <Brain size={12} color="#2563EB" />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 8.5, fontWeight: 700, color: "#0F172A" }}>RAG &amp; Vector Databases</div>
                            <div style={{ fontSize: 7.5, color: "#64748B" }}>Lesson 3 of 6 in progress</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {mobileLearnerTab === "ai" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ background: "#0F172A", borderRadius: 8, padding: "8px 9px", color: "#FFFFFF" }}>
                          <div style={{ fontSize: 10.5, fontWeight: 800 }}>24/7 AI Learning Coach</div>
                          <div style={{ fontSize: 8, color: "#CBD5E1", marginTop: 1 }}>
                            Ask homework questions, debug code, and take practice quizzes.
                          </div>
                        </div>

                        <div style={{ background: "#FFFFFF", borderRadius: 8, border: "1px solid #E2E8F0", padding: "7px" }}>
                          <div style={{ fontSize: 9.5, fontWeight: 700, color: "#0F172A" }}>Adaptive Quiz Generator</div>
                          <div style={{ fontSize: 8, color: "#64748B", marginBottom: 3 }}>Custom assessment generated in real time</div>
                          <button style={{ width: "100%", background: "#2563EB", color: "#fff", border: "none", borderRadius: 4, padding: "4px 6px", fontSize: 8.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}>
                            Start 5-Min Quiz
                          </button>
                        </div>
                      </div>
                    )}

                    {mobileLearnerTab === "community" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ background: "#0F172A", borderRadius: 8, padding: "8px 9px", color: "#FFFFFF" }}>
                          <div style={{ fontSize: 10.5, fontWeight: 800 }}>Cohort Community Hub</div>
                          <div style={{ fontSize: 8, color: "#CBD5E1", marginTop: 1 }}>
                            Collaborate with classmates and mentors.
                          </div>
                        </div>

                        <div style={{ background: "#FFFFFF", borderRadius: 8, border: "1px solid #E2E8F0", padding: "7px" }}>
                          <div style={{ fontSize: 7.5, fontWeight: 700, color: "#2563EB", marginBottom: 2 }}>
                            PINNED DISCUSSION
                          </div>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "#0F172A" }}>
                            Best practices for low-latency embeddings
                          </div>
                          <div style={{ fontSize: 8, color: "#64748B", marginTop: 2 }}>
                            14 classmates contributed solutions
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Nav Bar */}
                  <div style={{
                    height: 36, background: "#FFFFFF", borderTop: "1px solid #E2E8F0",
                    display: "flex", alignItems: "center", justifyContent: "space-around",
                    padding: "0 2px"
                  }}>
                    <div className={`phone-nav-item ${mobileLearnerTab === "home" ? "active" : ""}`} onClick={() => setMobileLearnerTab("home")}>
                      <Home size={11} /> {mobileLearnerTab === "home" && <span>Home</span>}
                    </div>
                    <div className={`phone-nav-item ${mobileLearnerTab === "courses" ? "active" : ""}`} onClick={() => setMobileLearnerTab("courses")}>
                      <BookOpen size={11} /> {mobileLearnerTab === "courses" && <span>Courses</span>}
                    </div>
                    <div className={`phone-nav-item ${mobileLearnerTab === "ai" ? "active" : ""}`} onClick={() => setMobileLearnerTab("ai")}>
                      <Zap size={11} /> {mobileLearnerTab === "ai" && <span>AI</span>}
                    </div>
                    <div className={`phone-nav-item ${mobileLearnerTab === "community" ? "active" : ""}`} onClick={() => setMobileLearnerTab("community")}>
                      <Users size={11} /> {mobileLearnerTab === "community" && <span>Social</span>}
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* =========================================================================
          SECTION 6: HOW IT WORKS
          ========================================================================= */}
      <section id="how-it-works" className="lp-bg-surface-2" style={{ width: "100%" }}>
        <div className="lp-section-inner" style={{ maxWidth: 1180, margin: "0 auto", padding: "48px 20px 58px", textAlign: "center" }}>
          
          <h2 className="lp-section-h2" style={{ fontSize: 30, fontWeight: 900, letterSpacing: "-0.03em", color: "#0F172A", margin: "0 0 6px" }}>
            How It Works
          </h2>
          <p style={{ fontSize: 14.5, color: "#64748B", maxWidth: 520, margin: "0 auto 30px" }}>
            From onboarding cohorts to measurable capability and certified outcomes
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, textAlign: "left" }}>
            
            <div className="lp-step-card" style={{ background: "#FFFFFF", borderRadius: 10, padding: "22px 18px", border: "1px solid #E2E8F0" }}>
              <div style={{ width: 34, height: 34, borderRadius: 6, background: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", marginBottom: 12 }}>
                <UserPlus size={17} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: "0 0 6px" }}>1. Launch Your Cohort</h3>
              <p style={{ fontSize: 12.5, color: "#64748B", margin: 0, lineHeight: 1.5 }}>
                Invite students, community learners, or employees. Group them into classes or cohorts with role-based access.
              </p>
            </div>

            <div className="lp-step-card" style={{ background: "#FFFFFF", borderRadius: 10, padding: "22px 18px", border: "1px solid #E2E8F0" }}>
              <div style={{ width: 34, height: 34, borderRadius: 6, background: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", marginBottom: 12 }}>
                <BookOpen size={17} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: "0 0 6px" }}>2. Deliver &amp; Coach</h3>
              <p style={{ fontSize: 12.5, color: "#64748B", margin: 0, lineHeight: 1.5 }}>
                Assign verified curriculum tracks and let learners practice with 24/7 AI tutor guidance and faculty feedback.
              </p>
            </div>

            <div className="lp-step-card" style={{ background: "#FFFFFF", borderRadius: 10, padding: "22px 18px", border: "1px solid #E2E8F0" }}>
              <div style={{ width: 34, height: 34, borderRadius: 6, background: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", marginBottom: 12 }}>
                <Award size={17} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: "0 0 6px" }}>3. Certify &amp; Report</h3>
              <p style={{ fontSize: 12.5, color: "#64748B", margin: 0, lineHeight: 1.5 }}>
                Issue verified institutional credentials and export live readiness scores for academic boards, donors, or executives.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* =========================================================================
          SECTION 7: TRUST, SECURITY & LOW BANDWIDTH
          ========================================================================= */}
      <section id="trust" className="lp-bg-surface-1" style={{ width: "100%" }}>
        <div className="lp-section-inner" style={{ maxWidth: 1180, margin: "0 auto", padding: "44px 20px 54px", textAlign: "left" }}>
          
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#2563EB", letterSpacing: ".06em" }}>INSTITUTIONAL TRUST</span>
          </div>

          <h2 className="lp-section-h2" style={{ fontSize: 30, fontWeight: 900, letterSpacing: "-0.03em", color: "#0F172A", margin: "0 0 8px" }}>
            Trust and accessibility built in
          </h2>

          <p style={{ fontSize: 14.5, color: "#64748B", maxWidth: 620, margin: "0 0 26px", lineHeight: 1.5 }}>
            Data isolation, privacy compliance, auditability, and low-bandwidth delivery are foundational to Train AI.
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
      <section id="faq" className="lp-bg-surface-2" style={{ width: "100%" }}>
        <div className="lp-section-inner" style={{ maxWidth: 820, margin: "0 auto", padding: "48px 20px 60px", textAlign: "left" }}>
          
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <h2 className="lp-section-h2" style={{ fontSize: 30, fontWeight: 900, letterSpacing: "-0.035em", color: "#0F172A", margin: "0 0 6px" }}>
              Frequently Asked Questions
            </h2>
            <p style={{ fontSize: 14.5, color: "#64748B", margin: 0 }}>
              Everything you need to know about Train AI for academies, NGOs, and businesses.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {FAQ_ITEMS.map((item, i) => {
              const isOpen = openFaq === i;
              return (
                <div
                  key={item.q}
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #E2E8F0",
                    borderRadius: 10,
                    padding: "2px 18px",
                    boxShadow: isOpen ? "0 2px 8px rgba(15, 23, 42, 0.04)" : "none"
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
                      style={{
                        transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.2s ease",
                        flexShrink: 0
                      }}
                    />
                  </button>
                  {isOpen && <p style={{ margin: "0 0 14px", fontSize: 13, color: "#475569", lineHeight: 1.55 }}>{item.a}</p>}
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
            background: "#0F172A",
            borderRadius: 12, padding: "44px 24px", textAlign: "center", color: "#FFFFFF"
          }}>
            <h2 style={{ fontSize: "clamp(24px, 3.2vw, 36px)", fontWeight: 900, letterSpacing: "-0.035em", margin: "0 0 12px", color: "#FFFFFF", lineHeight: 1.2 }}>
              Ready to elevate how your organization learns?
            </h2>
            
            <p style={{ fontSize: 14.5, color: "#CBD5E1", maxWidth: 620, margin: "0 auto 24px", lineHeight: 1.55 }}>
              Join academic institutions, non-profit foundations, and growing enterprises building verified skills with Train AI.
            </p>

            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginBottom: 20 }}>
              <button
                className="action-btn-primary"
                style={{ padding: "10px 22px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13.5, display: "inline-flex", alignItems: "center", gap: 6 }}
                onClick={() => handleNav("signin")}
              >
                Get Started <ArrowRight size={14} />
              </button>
              <button
                style={{ background: "rgba(255,255,255,0.08)", color: "#FFFFFF", fontWeight: 600, padding: "10px 18px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.25)", cursor: "pointer", fontSize: 13.5 }}
                onClick={() => handleNav("book-demo")}
              >
                Book a Demo
              </button>
              <button
                style={{ background: "transparent", color: "#CBD5E1", fontWeight: 600, padding: "10px 18px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.18)", cursor: "pointer", fontSize: 13.5 }}
                onClick={() => handleNav("signin")}
              >
                Sign In
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap", fontSize: 11.5, color: "#94A3B8", fontWeight: 600 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <CheckCircle2 size={13} color="#34D399" /> Academic Disounts
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <CheckCircle2 size={13} color="#34D399" /> Subsidized NGO Plans
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <CheckCircle2 size={13} color="#34D399" /> Enterprise SLAs
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 10: DARK FOOTER
          ========================================================================= */}
      <footer style={{ background: "#0B1120", color: "#FFFFFF", paddingTop: 36, paddingBottom: 28, borderTop: "1px solid #1E293B" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 20px" }}>
          
          {/* Newsletter Box */}
          <div style={{
            background: "#111827", borderRadius: 10, padding: "24px 20px",
            border: "1px solid #1E293B", textAlign: "center", marginBottom: 36
          }}>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: "#FFFFFF", margin: "0 0 4px" }}>
              Stay Updated with Train AI
            </h3>
            <p style={{ fontSize: 12.5, color: "#94A3B8", margin: "0 0 14px" }}>
              Receive updates on academic tracks, NGO grants, and platform feature releases.
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
                  placeholder="Enter your institutional email"
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
            
            {/* Brand column */}
            <div>
              <img src="/logo-dark.png" alt="Train AI" style={{ height: 22, width: "auto", objectFit: "contain", display: "block", marginBottom: 10 }} />
              <p style={{ fontSize: 12, color: "#94A3B8", lineHeight: 1.5, margin: "0 0 14px", maxWidth: 260 }}>
                AI-powered learning and capability platform for academies, NGOs, and businesses.
              </p>
              <div style={{ display: "flex", gap: 6 }}>
                <div className="lp-social-btn" aria-label="Facebook"><Facebook size={14} /></div>
                <div className="lp-social-btn" aria-label="Twitter"><Twitter size={14} /></div>
                <div className="lp-social-btn" aria-label="Instagram"><Instagram size={14} /></div>
                <div className="lp-social-btn" aria-label="LinkedIn"><Linkedin size={14} /></div>
              </div>
            </div>

            {/* Sector column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#FFFFFF", marginBottom: 1 }}>Sectors</div>
              <span className="lp-footer-link" onClick={() => { setActiveSector("academies"); scrollToId("sectors"); }}>For Academies &amp; Higher Ed</span>
              <span className="lp-footer-link" onClick={() => { setActiveSector("ngos"); scrollToId("sectors"); }}>For NGOs &amp; Non-Profits</span>
              <span className="lp-footer-link" onClick={() => { setActiveSector("businesses"); scrollToId("sectors"); }}>For Businesses &amp; Teams</span>
              <span className="lp-footer-link" onClick={() => scrollToId("pricing")}>Partnership &amp; Pricing</span>
              <span className="lp-footer-link" onClick={() => handleNav("book-demo")}>Book a Demo (Live Scheduler)</span>
            </div>

            {/* Platform column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#FFFFFF", marginBottom: 1 }}>Platform</div>
              <span className="lp-footer-link" onClick={() => scrollToId("intelligence")}>Intelligence Layer</span>
              <span className="lp-footer-link" onClick={() => scrollToId("learners")}>Learner App</span>
              <span className="lp-footer-link" onClick={() => scrollToId("how-it-works")}>Cohort Architecture</span>
              <span className="lp-footer-link" onClick={() => scrollToId("trust")}>Data Security</span>
            </div>

            {/* Legal column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#FFFFFF", marginBottom: 1 }}>Organization</div>
              <span className="lp-footer-link" onClick={() => handleNav("about")}>About Us</span>
              <span className="lp-footer-link" onClick={() => handleNav("privacy")}>Privacy Policy</span>
              <span className="lp-footer-link" onClick={() => handleNav("terms")}>Terms of Service</span>
              <span className="lp-footer-link" onClick={() => handleNav("cookie")}>Cookie Policy</span>
            </div>

          </div>

          {/* Bottom Copyright */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, paddingTop: 16, borderTop: "1px solid #1E293B", fontSize: 11.5, color: "#64748B" }}>
            <div>
              © 2025 Train AI Ltd. All rights reserved. Headquartered in London, United Kingdom.
            </div>
            <div style={{ display: "flex", gap: 14 }}>
              <span className="lp-footer-link" onClick={() => handleNav("about")}>About Us</span>
              <span className="lp-footer-link" onClick={() => handleNav("privacy")}>Privacy Policy</span>
              <span className="lp-footer-link" onClick={() => handleNav("terms")}>Terms of Service</span>
            </div>
          </div>

        </div>
      </footer>

      {/* Partnership & Demo Inquiry Modal */}
      {demoModalOpen && (
        <div style={styles.modalOverlay} onClick={() => setDemoModalOpen(false)} role="presentation">
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: "#0F172A", margin: 0 }}>Request Partnership or Demo</h3>
                <p style={{ fontSize: 12, color: "#64748B", margin: "2px 0 0" }}>Tailored for academies, NGOs, and enterprise employers.</p>
              </div>
              <button style={styles.modalClose} onClick={() => setDemoModalOpen(false)} aria-label="Close">
                <X size={16} />
              </button>
            </div>

            {demoSubmitted ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 12, background: "#ECFDF5", color: "#059669", borderRadius: 8, fontWeight: 600, fontSize: 13 }}>
                <CheckCircle2 size={16} />
                <span>Thank you! Our institutional partnerships team will contact you shortly.</span>
              </div>
            ) : (
              <form onSubmit={handleDemoSubmit} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <input
                    required placeholder="Full name" value={demoName} onChange={(e) => setDemoName(e.target.value)}
                    style={styles.formInput}
                  />
                  <input
                    required placeholder="Organization name" value={demoCompany} onChange={(e) => setDemoCompany(e.target.value)}
                    style={styles.formInput}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <input
                    type="email" required placeholder="Work / institutional email" value={demoEmail} onChange={(e) => setDemoEmail(e.target.value)}
                    style={styles.formInput}
                  />
                  <select
                    value={demoOrgType} onChange={(e) => setDemoOrgType(e.target.value)}
                    style={styles.formInput}
                  >
                    {ORG_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
                  <select
                    value={demoTeamSize} onChange={(e) => setDemoTeamSize(e.target.value)}
                    style={styles.formInput}
                  >
                    {TEAM_SIZE_OPTIONS.map((t) => <option key={t} value={t}>{t} learners / team size</option>)}
                  </select>
                </div>
                <textarea
                  placeholder="Tell us about your cohort, curriculum goals, or grant timeline (optional)"
                  value={demoMessage} onChange={(e) => setDemoMessage(e.target.value)}
                  rows={2} style={styles.formTextarea}
                />
                <button type="submit" disabled={submitting} className="action-btn-primary" style={styles.modalSubmitBtn}>
                  {submitting ? "Submitting..." : "Submit Inquiry"} <ArrowRight size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDemoModalOpen(false);
                    handleNav("book-demo");
                  }}
                  style={{
                    background: "#F8FAFC",
                    border: "1px solid #CBD5E1",
                    borderRadius: 6,
                    padding: "8px 10px",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#1D4ED8",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    marginTop: 4
                  }}
                >
                  <Calendar size={13} color="#2563EB" /> Or Select Day &amp; Time on Live Scheduler
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
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 100 },
  modalCard: { background: "#FFFFFF", borderRadius: 8, padding: 20, maxWidth: 460, width: "100%", maxHeight: "85vh", overflowY: "auto", border: "1px solid #E2E8F0", boxShadow: "0 8px 30px rgba(15,23,42,0.2)" },
  modalClose: { border: "none", background: "#F1F5F9", borderRadius: 6, padding: 5, cursor: "pointer", display: "flex", color: "#64748B" },
  formInput: { width: "100%", border: "1px solid #E2E8F0", padding: "8px 10px", fontSize: 12, borderRadius: 6, outline: "none", boxSizing: "border-box", color: "#0F172A", background: "#FFFFFF" },
  formTextarea: { width: "100%", border: "1px solid #E2E8F0", padding: "8px 10px", fontSize: 12, borderRadius: 6, outline: "none", boxSizing: "border-box", color: "#0F172A", resize: "vertical", fontFamily: "inherit", background: "#FFFFFF" },
  modalSubmitBtn: { border: "none", padding: "10px 16px", borderRadius: 6, fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }
};
