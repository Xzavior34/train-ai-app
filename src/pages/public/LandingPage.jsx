import React, { useState, useEffect } from "react";
import {
  ArrowRight, BookOpen, GraduationCap, Cpu, ShieldCheck, CheckCircle2, Globe, X,
  Brain, Layers, ChevronDown, HelpCircle, ClipboardList, UserPlus, Rocket,
  Building2, Users, Target, TrendingUp, AlertTriangle, Eye, Lock, Compass, BarChart3,
  GitCompare, Table, School, Handshake, Briefcase, Zap, Sparkles, Flame, Menu, Check,
  Play, MessageSquare, Laptop, Award, Star, Activity, ArrowUpRight
} from "lucide-react";
import { submitDemoRequest, submitOrganizationInquiry, captureAttributionFromURL } from "../../lib/api/waitlist.js";
import { trackReferralClickIfPresent } from "../../lib/api/organizations.js";

const TEAM_SIZE_OPTIONS = ["1–50", "51–200", "201–1,000", "1,000+"];

const LEGAL_CONTENT = {
  about: {
    title: "About Us",
    body: "Train AI is the next-generation AI-powered learning operating system that provides organizations with a live, real-time map of workforce skills. We connect enterprise learners, instructors, and curated curriculum into adaptive, job-ready pathways to close skill gaps before they impact business delivery."
  },
  privacy: {
    title: "Privacy Policy",
    body: "Our Privacy Policy ensures that your enterprise and learner data remains strictly confidential. We only process data required to deliver personalized learning paths, track progress, and issue verified certifications. We never sell personal data or use customer data to train public foundation models."
  },
  terms: {
    title: "Terms of Service",
    body: "Train AI terms govern organizational workspaces, role-based licensing, and institutional agreements. All accounts and certifications are auditable and protected under enterprise service level agreements. For queries, reach out to hello@trainailtd.com."
  },
  cookie: {
    title: "Cookie Policy",
    body: "We use strictly necessary session cookies to maintain secure authentication. Optional analytics and telemetry cookies remain disabled until explicit user consent is provided. Questions: hello@trainailtd.com."
  }
};

const PARTNERS = [
  "Google Cloud Certified", "OpenAI Partner Network", "Anthropic AI Ecosystem",
  "Figma Official Partner", "Apple VisionOS Labs", "AWS Training Partner",
  "LangChain AI Guild", "Supabase Enterprise", "Linux Foundation"
];

const PREVIEW_TRACKS = [
  {
    id: "track-ai",
    title: "Full-Stack Generative AI Application Architect",
    category: "AI & Machine Learning",
    hours: "56 Hours • 4 Courses",
    rating: 4.9,
    enrolled: "18.6k learners",
    image: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80",
    badge: "CAREER TRACK",
    skills: ["LangChain", "Vector DBs", "FastAPI", "React 19", "Autonomous Agents"]
  },
  {
    id: "track-design",
    title: "AI Product Design & Spatial Systems Specialization",
    category: "UI/UX & Design Systems",
    hours: "48 Hours • 4 Courses",
    rating: 4.9,
    enrolled: "14.2k learners",
    image: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&auto=format&fit=crop&q=80",
    badge: "PROFESSIONAL CERTIFICATE",
    skills: ["Figma AI", "Design Tokens", "VisionOS Ergonomics", "Spatial Three.js"]
  },
  {
    id: "track-cloud",
    title: "Cloud Infrastructure, Kubernetes & AI MLOps",
    category: "Cloud & DevOps",
    hours: "42 Hours • 3 Courses",
    rating: 4.8,
    enrolled: "9.3k learners",
    image: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=80",
    badge: "INDUSTRY ACCREDITED",
    skills: ["Kubernetes", "Docker", "GPU Autoscaling", "Prometheus / Grafana"]
  },
  {
    id: "track-growth",
    title: "AI Product Management, Growth & Data Strategy",
    category: "Product & Strategy",
    hours: "38 Hours • 3 Courses",
    rating: 4.9,
    enrolled: "7.8k learners",
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80",
    badge: "EXECUTIVE CERTIFICATE",
    skills: ["AI Roadmapping", "Cohort Retention", "A/B Experimentation", "Model ROI"]
  }
];

const PROBLEM_POINTS = [
  {
    icon: Eye,
    title: "Zero Real-Time Skill Visibility",
    desc: "You know teams are 'in training', but you don't know who is actually building the required skills or when they will be ready to deploy on production workloads.",
    badge: "THE VISIBILITY GAP"
  },
  {
    icon: GitCompare,
    title: "Siloed Learning & Performance Tools",
    desc: "Learning lives in one platform, performance reviews in another, and skills inventory in spreadsheets. By the time a gap hits a sprint, the project is already at risk.",
    badge: "OUT OF SYNC"
  },
  {
    icon: AlertTriangle,
    title: "85% Course Dropout & Zero Retention",
    desc: "Traditional video-dump LMS platforms suffer from 80–85% drop-off rates, leaving organizations with heavy licensing costs and no measurable capability uplift.",
    badge: "LEGACY DROPOUT"
  }
];

const INTELLIGENCE_LAYERS = [
  { icon: BookOpen, letter: "Learn", tag: "Layer 01", title: "Adaptive Skill Pathways", desc: "Dynamic personalized learning roadmaps tailored to the exact role, pacing, and enterprise skill benchmarks.", image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop&q=80" },
  { icon: TrendingUp, letter: "Perform", tag: "Layer 02", title: "Live Workforce Telemetry", desc: "Instant visibility into learner progress, module completion velocity, and real-time comprehension signals.", image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&auto=format&fit=crop&q=80" },
  { icon: Users, letter: "Develop", tag: "Layer 03", title: "Cohort Circles & Mentors", desc: "Structured cohort study groups, live instructor masterclasses, and 1-on-1 expert office hours for hands-on guidance.", image: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&auto=format&fit=crop&q=80" },
  { icon: BarChart3, letter: "Measure", tag: "Layer 04", title: "Executive Readiness Radar", desc: "Department-by-department skill readiness scoring that turns learning data into actionable executive hiring and delivery decisions.", image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80" },
  { icon: Cpu, letter: "Automate", tag: "Layer 05", title: "AI Neural Co-Pilot", desc: "24/7 intelligent tutoring, automated practice quiz generation, and AI-driven skill gap remediation.", image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80" }
];

const HOW_IT_WORKS = [
  { icon: UserPlus, title: "Onboard Your Workforce", desc: "Import teams, map competencies, and pair every learner with an AI Neural Learning Coach matched to their role." },
  { icon: Target, title: "Assign Sequenced Pathways", desc: "Deploy automated or custom learning tracks tailored to business delivery milestones, compliance, and tech stacks." },
  { icon: TrendingUp, title: "Track Real Skill Growth", desc: "Observe live capability development through hands-on capstones, interactive code sandboxes, and verified assessments." },
  { icon: Rocket, title: "Deploy Job-Ready Talent", desc: "Know exactly who is ready to lead the next major initiative, transition into engineering, or scale AI tooling." }
];

const COMPARISON_ROWS = [
  { dimension: "Core Focus", lms: "Video completion logs", trainai: "Live workforce job readiness" },
  { dimension: "Skill Mapping", lms: "Static course tags", trainai: "Real-time AI Skill Graph" },
  { dimension: "Learner Support", lms: "Pre-recorded videos only", trainai: "24/7 AI Coach + Live Instructors" },
  { dimension: "Executive Value", lms: "Compliance checkboxes", trainai: "Department readiness scoring (0-100)" },
  { dimension: "Compliance & Audit", lms: "Spreadsheet exports", trainai: "Append-only verifiable audit log" }
];

const PRICING_TIERS = [
  {
    name: "Starter Team",
    tagline: "For dynamic teams looking to accelerate skill mastery with structured cohorts and AI coaching.",
    price: "Custom",
    priceNote: "Per user • Flexible billing",
    features: [
      "Full learner experience: 24/7 AI Learning Coach & Quiz Generator",
      "Full access to 40+ curated masterclasses & career tracks",
      "Cohort study circles & discussion forums",
      "Verified digital certificates & badges",
      "Single-team administrative dashboard"
    ],
    highlighted: false,
  },
  {
    name: "Enterprise Growth",
    tagline: "For scaling organizations requiring department-level readiness metrics and automated skill mapping.",
    price: "Volume",
    priceNote: "Tiered volume pricing as team scales",
    features: [
      "Everything in Starter Team, plus:",
      "Live Organization Skill Graph & Readiness Radar",
      "Department-level dashboards with Manager & Instructor roles",
      "Automated compliance tracking & audit-ready exports",
      "Custom internal course authoring & SCORM uploads",
      "Dedicated Customer Success Manager & quarterly talent reviews"
    ],
    highlighted: true,
  },
  {
    name: "Institutional Custom",
    tagline: "For enterprises, universities, and governments requiring custom integrations and dedicated deployment.",
    price: "Enterprise",
    priceNote: "Annual contract with tailored SLAs",
    features: [
      "Everything in Enterprise Growth, plus:",
      "Custom role-to-skill frameworks & competency mapping",
      "Enterprise SSO (SAML / Okta) and HRIS data sync",
      "Custom white-label branding, logo, and domain",
      "On-premise / isolated cloud data tenancy options",
      "24/7 Priority SLA support & dedicated solutions architect"
    ],
    highlighted: false,
  }
];

const FAQ_ITEMS = [
  {
    q: "How does Train AI differ from a legacy video LMS?",
    a: "Legacy LMS platforms merely track video playback and quiz attempts. Train AI is an AI Workforce Intelligence System that measures true skill competency, identifies gaps in real time, and provides learners with an interactive 24/7 AI tutor and live instructor network."
  },
  {
    q: "Can our organization upload proprietary courses and private content?",
    a: "Yes. Train AI supports internal custom courses, SCORM packages, rich markdown curricula, video hosting, and bespoke assessments. Your internal materials remain strictly private to your organization workspace."
  },
  {
    q: "How does the AI Neural Coach support learners?",
    a: "The AI Coach operates 24/7 inside every course lesson. It provides contextual explanations, generates practice quizzes tailored to learner weak spots, debugs code snippets, and suggests targeted next steps."
  },
  {
    q: "What security, privacy, and compliance standards does Train AI support?",
    a: "Train AI includes GDPR-compliant append-only audit logging, DSAR data export capabilities, multi-tenant workspace isolation, and zero customer data model training."
  }
];

export default function LandingPage({ onNavigate }) {
  useEffect(() => { captureAttributionFromURL(); }, []);
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) trackReferralClickIfPresent(ref);
  }, []);

  const [activePreviewTab, setActivePreviewTab] = useState("readiness");
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
  const [contactMode, setContactMode] = useState("demo");
  const [selectedTrackModal, setSelectedTrackModal] = useState(null);

  useEffect(() => {
    if (!activeModal) return;
    function handleKeyDown(e) {
      if (e.key === "Escape") setActiveModal(null);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activeModal]);

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
    if (["platform", "solutions", "tracks", "why-train-ai", "pricing", "individuals", "book-demo"].includes(target)) {
      scrollToId(target);
      return;
    }
    onNavigate(target);
  }

  return (
    <div style={styles.outer}>
      <style>{`
        @keyframes pulseGlow { 0% { opacity: 0.35; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.08); } 100% { opacity: 0.35; transform: scale(1); } }
        @keyframes tickerMove { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes floatCard { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }

        .lp-pulse-glow { animation: pulseGlow 6s ease-in-out infinite; }
        .lp-ticker-track { display: flex; width: max-content; animation: tickerMove 30s linear infinite; }
        .lp-ticker-track:hover { animation-play-state: paused; }

        .lp-card { transition: all .22s cubic-bezier(0.16, 1, 0.3, 1); }
        .lp-card:hover { transform: translateY(-4px); box-shadow: 0 16px 36px -8px rgba(15,23,42,.12); border-color: #C7D2FE !important; }

        .lp-nav-link { transition: color .15s ease; cursor: pointer; }
        .lp-nav-link:hover { color: #4F46E5 !important; }
        .lp-footer-link { transition: color .15s ease; cursor: pointer; }
        .lp-footer-link:hover { color: #4F46E5 !important; }

        .action-btn { transition: transform .15s ease, box-shadow .15s ease; }
        .action-btn:hover { transform: translateY(-1px); box-shadow: 0 12px 28px -4px rgba(79, 70, 229, 0.45); }
        .action-btn:active { transform: scale(.97); }

        .lp-faq-chevron { transition: transform .2s ease; }
        .lp-question-pill { transition: transform .15s ease, box-shadow .15s ease; }
        .lp-question-pill:hover { transform: translateY(-2px); box-shadow: 0 6px 16px -6px rgba(15,23,42,.1); border-color: #C7D2FE; }

        @media (max-width: 860px) {
          .lp-desktop-nav { display: none !important; }
          .lp-mobile-menu-btn { display: flex !important; }
        }
        @media (min-width: 861px) {
          .lp-mobile-drawer { display: none !important; }
          .lp-mobile-menu-btn { display: none !important; }
        }
        @media (max-width: 640px) {
          .lp-hero-h1 { font-size: 29px !important; }
          .lp-hero-sub { font-size: 14.5px !important; }
          .lp-section-h2 { font-size: 23px !important; }
          .lp-section { padding: 48px 16px !important; }
          .lp-mockup-grid { grid-template-columns: 1fr !important; }
          .lp-preview-tabs { flex-wrap: wrap !important; }
        }
      `}</style>

      {/* Sticky Glassmorphic Navbar */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          
          {/* Brand Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => handleNav("home")}>
            <img src="/train-ai-logo.png" alt="Train AI" style={{ height: 44, width: "auto", objectFit: "contain", display: "block" }} />
          </div>

          {/* Desktop Nav Links */}
          <nav className="lp-desktop-nav" style={{ display: "flex", gap: 24, alignItems: "center" }}>
            <span className="lp-nav-link" style={styles.navLink} onClick={() => handleNav("platform")}>Platform</span>
            <span className="lp-nav-link" style={styles.navLink} onClick={() => handleNav("tracks")}>Career Tracks</span>
            <span className="lp-nav-link" style={styles.navLink} onClick={() => handleNav("solutions")}>Solutions</span>
            <span className="lp-nav-link" style={styles.navLink} onClick={() => handleNav("why-train-ai")}>Why Train AI</span>
            <span className="lp-nav-link" style={styles.navLink} onClick={() => handleNav("pricing")}>Pricing</span>
          </nav>

          {/* Action CTAs */}
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              className="action-btn"
              style={styles.signInBtn}
              onClick={() => handleNav("signin")}
            >
              Sign In
            </button>
            <button
              className="action-btn"
              style={styles.getStartedBtn}
              onClick={() => handleNav("book-demo")}
            >
              Book a Demo
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
          <div className="lp-mobile-drawer" style={{ background: "#FFFFFF", borderTop: "1px solid #E2E8F0", padding: "16px 20px 24px", display: "flex", flexDirection: "column", gap: 12, boxShadow: "0 10px 25px rgba(0,0,0,0.06)" }}>
            <span className="lp-nav-link" style={{ fontSize: 15, fontWeight: 700, padding: "8px 0" }} onClick={() => handleNav("platform")}>Platform</span>
            <span className="lp-nav-link" style={{ fontSize: 15, fontWeight: 700, padding: "8px 0" }} onClick={() => handleNav("tracks")}>Career Tracks</span>
            <span className="lp-nav-link" style={{ fontSize: 15, fontWeight: 700, padding: "8px 0" }} onClick={() => handleNav("solutions")}>Solutions</span>
            <span className="lp-nav-link" style={{ fontSize: 15, fontWeight: 700, padding: "8px 0" }} onClick={() => handleNav("why-train-ai")}>Why Train AI</span>
            <span className="lp-nav-link" style={{ fontSize: 15, fontWeight: 700, padding: "8px 0" }} onClick={() => handleNav("pricing")}>Pricing</span>
          </div>
        )}
      </header>

      {/* =========================================================================
          HERO SECTION (High-Impact Modern LMS Operating System)
          ========================================================================= */}
      <section style={{ position: "relative", overflow: "hidden", padding: "70px 20px 80px", textAlign: "center" }}>
        
        {/* Ambient Floating Glow Orbs */}
        <div className="lp-pulse-glow" style={{ position: "absolute", top: -140, left: "50%", transform: "translateX(-50%)", width: 680, height: 420, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.22) 0%, rgba(79,70,229,0.08) 50%, transparent 80%)", pointerEvents: "none", zIndex: 0 }} />
        <div className="lp-pulse-glow" style={{ position: "absolute", top: 180, right: -120, width: 440, height: 380, borderRadius: "50%", background: "radial-gradient(circle, rgba(236,72,153,0.14) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

        <div style={{ maxWidth: 1140, margin: "0 auto", position: "relative", zIndex: 1 }}>
          
          {/* Animated Hero Badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 99,
            background: "linear-gradient(135deg, #EEF2FF 0%, #F5F3FF 100%)", border: "1px solid #E0E7FF",
            color: "#4F46E5", fontSize: 12.5, fontWeight: 800, marginBottom: 20
          }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#4F46E5", display: "inline-block", boxShadow: "0 0 8px #6366F1" }} />
            <span>AI WORKFORCE INTELLIGENCE &amp; LEARNING OS</span>
          </div>

          {/* Hero Headline */}
          <h1 className="lp-hero-h1" style={{ fontSize: "clamp(32px, 4.6vw, 54px)", fontWeight: 900, letterSpacing: "-0.03em", color: "#0F172A", margin: "0 auto 18px", maxWidth: 880, lineHeight: 1.12 }}>
            Measure workforce readiness,<br />
            <span style={{ background: "linear-gradient(135deg, #4338CA 0%, #4F46E5 50%, #6366F1 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              not passive course completion.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="lp-hero-sub" style={{ fontSize: "clamp(15px, 1.8vw, 18px)", color: "#475569", maxWidth: 760, margin: "0 auto 30px", lineHeight: 1.55 }}>
            Train AI turns daily learning activity into a live, decision-ready skill graph. Identify team capability gaps, deliver adaptive pathways, and accelerate time-to-production with 24/7 AI tutoring.
          </p>

          {/* Dual CTAs */}
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", marginBottom: 36 }}>
            <button className="action-btn" style={styles.getStartedBtn} onClick={() => handleNav("book-demo")}>
              Start with your organisation <ArrowRight size={16} />
            </button>
            <button className="action-btn" style={styles.secondaryBtn} onClick={() => handleNav("tracks")}>
              Explore Career Pathways
            </button>
          </div>

          {/* Live Metric Pills */}
          <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 14, marginBottom: 40 }}>
            <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", padding: "10px 18px", borderRadius: 14, textAlign: "left", boxShadow: "0 2px 8px rgba(15,23,42,0.03)" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A", display: "flex", alignItems: "center", gap: 6 }}>
                <Layers size={14} color="#4F46E5" /> Live Skill Graph
              </div>
              <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 2 }}>Held • developing • missing</div>
            </div>
            <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", padding: "10px 18px", borderRadius: 14, textAlign: "left", boxShadow: "0 2px 8px rgba(15,23,42,0.03)" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A", display: "flex", alignItems: "center", gap: 6 }}>
                <TrendingUp size={14} color="#4F46E5" /> Readiness Radar
              </div>
              <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 2 }}>Team • department • org</div>
            </div>
            <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", padding: "10px 18px", borderRadius: 14, textAlign: "left", boxShadow: "0 2px 8px rgba(15,23,42,0.03)" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A", display: "flex", alignItems: "center", gap: 6 }}>
                <Zap size={14} color="#4F46E5" /> 24/7 AI Neural Coach
              </div>
              <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 2 }}>Instant answers • code evals</div>
            </div>
          </div>

          {/* =========================================================================
              DYNAMIC INTERACTIVE PLATFORM PREVIEW STUDIO
              ========================================================================= */}
          <div style={{
            position: "relative", borderRadius: 24, overflow: "hidden",
            border: "1.5px solid #E2E8F0", background: "#FFFFFF",
            boxShadow: "0 26px 70px -12px rgba(79, 70, 229, 0.22), 0 10px 30px -4px rgba(15, 23, 42, 0.08)",
            textAlign: "left"
          }}>
            {/* Studio Browser Header with Interactive Tab Switcher */}
            <div style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#EF4444" }} />
                <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#F59E0B" }} />
                <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#10B981" }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B", marginLeft: 8 }}>app.trainailtd.com/live-workforce-studio</span>
              </div>

              {/* Interactive Preview Tabs */}
              <div className="lp-preview-tabs" style={{ display: "flex", gap: 6 }}>
                {[
                  { id: "readiness", label: "Workforce Readiness" },
                  { id: "skills", label: "Live Skill Graph" },
                  { id: "aicoach", label: "AI Neural Coach" }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActivePreviewTab(tab.id)}
                    style={{
                      padding: "5px 12px",
                      borderRadius: 8,
                      border: activePreviewTab === tab.id ? "1.5px solid #818CF8" : "1px solid #E2E8F0",
                      background: activePreviewTab === tab.id ? "#EEF2FF" : "#FFFFFF",
                      color: activePreviewTab === tab.id ? "#4F46E5" : "#64748B",
                      fontSize: 11.5,
                      fontWeight: 800,
                      cursor: "pointer"
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Dynamic Tab 1: Workforce Readiness View */}
            {activePreviewTab === "readiness" && (
              <div className="lp-mockup-grid" style={{ padding: 24, background: "#F8FAFC", display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 20 }}>
                
                <div style={{ background: "#FFFFFF", borderRadius: 18, border: "1px solid #E2E8F0", padding: 22, boxShadow: "0 4px 16px rgba(15, 23, 42, 0.04)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase" }}>ORGANIZATION CAPABILITY</div>
                      <div style={{ fontWeight: 800, fontSize: 17, color: "#0F172A", marginTop: 2 }}>Readiness by Department</div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#10B981", background: "#ECFDF5", padding: "3px 10px", borderRadius: 99, display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981" }} /> Live Telemetry
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 18 }}>
                    <span style={{ fontSize: 40, fontWeight: 900, color: "#0F172A", letterSpacing: "-0.03em" }}>71</span>
                    <span style={{ fontSize: 13, color: "#64748B", fontWeight: 600 }}>/ 100 Org Index</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "#10B981", background: "#ECFDF5", padding: "2px 8px", borderRadius: 6 }}>+18% Sprint Velocity</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>
                        <span style={{ color: "#334155" }}>Full-Stack AI Engineering</span>
                        <span style={{ color: "#4F46E5", fontWeight: 800 }}>88% (+12%)</span>
                      </div>
                      <div style={{ height: 7, borderRadius: 99, background: "#EEF2FF", overflow: "hidden" }}>
                        <div style={{ width: "88%", height: "100%", background: "linear-gradient(90deg, #4F46E5, #6366F1)", borderRadius: 99 }} />
                      </div>
                    </div>

                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>
                        <span style={{ color: "#334155" }}>Spatial UI &amp; Design Systems</span>
                        <span style={{ color: "#4F46E5", fontWeight: 800 }}>76% (+8%)</span>
                      </div>
                      <div style={{ height: 7, borderRadius: 99, background: "#EEF2FF", overflow: "hidden" }}>
                        <div style={{ width: "76%", height: "100%", background: "linear-gradient(90deg, #6366F1, #818CF8)", borderRadius: 99 }} />
                      </div>
                    </div>

                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>
                        <span style={{ color: "#334155" }}>Cloud Kubernetes &amp; MLOps</span>
                        <span style={{ color: "#4F46E5", fontWeight: 800 }}>64% (+5%)</span>
                      </div>
                      <div style={{ height: 7, borderRadius: 99, background: "#EEF2FF", overflow: "hidden" }}>
                        <div style={{ width: "64%", height: "100%", background: "linear-gradient(90deg, #818CF8, #A5B4FC)", borderRadius: 99 }} />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 20, paddingTop: 14, borderTop: "1px solid #E2E8F0" }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: "#0F172A" }}>12</div>
                      <div style={{ fontSize: 11, color: "#64748B" }}>Gaps Remedied</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: "#0F172A" }}>94%</div>
                      <div style={{ fontSize: 11, color: "#64748B" }}>Assessment Pass</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: "#0F172A" }}>8</div>
                      <div style={{ fontSize: 11, color: "#64748B" }}>Active Cohorts</div>
                    </div>
                  </div>
                </div>

                {/* Right Visual Image Card */}
                <div style={{
                  borderRadius: 18, overflow: "hidden", position: "relative",
                  border: "1px solid #E2E8F0", minHeight: 300,
                  backgroundImage: "url('https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&fit=crop&q=80')",
                  backgroundSize: "cover", backgroundPosition: "center",
                  display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 22
                }}>
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(15,23,42,0.92) 0%, rgba(15,23,42,0.3) 60%, transparent 100%)" }} />
                  <div style={{ position: "relative", color: "#FFFFFF", zIndex: 1 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 800, color: "#A5B4FC", textTransform: "uppercase", letterSpacing: ".04em" }}>TALENT ARCHITECTURE</div>
                    <div style={{ fontSize: 18, fontWeight: 900, marginTop: 4, lineHeight: 1.3 }}>Live Engineering &amp; Design Cohorts</div>
                    <div style={{ fontSize: 12.5, opacity: 0.85, marginTop: 4 }}>Structured peer accountability with certified mentors</div>
                  </div>
                </div>

              </div>
            )}

            {/* Dynamic Tab 2: Live Skill Graph View */}
            {activePreviewTab === "skills" && (
              <div style={{ padding: 24, background: "#F8FAFC", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
                {[
                  { name: "FastAPI Multi-Agent Services", held: "92% Engineers", status: "Verified", color: "#10B981" },
                  { name: "Vector DB Embeddings (pgvector)", held: "84% Engineers", status: "In Progress", color: "#6366F1" },
                  { name: "Figma Variables 2.0 & Tokens", held: "89% Designers", status: "Verified", color: "#10B981" },
                  { name: "VisionOS Spatial Ergonomics", held: "68% Designers", status: "Developing", color: "#F59E0B" }
                ].map(skill => (
                  <div key={skill.name} style={{ background: "#FFFFFF", padding: 16, borderRadius: 14, border: "1px solid #E2E8F0" }}>
                    <span style={{ fontSize: 10.5, fontWeight: 800, color: skill.color, textTransform: "uppercase" }}>{skill.status}</span>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#0F172A", margin: "4px 0 8px" }}>{skill.name}</div>
                    <div style={{ fontSize: 12, color: "#64748B" }}>Mastery Level: <strong>{skill.held}</strong></div>
                  </div>
                ))}
              </div>
            )}

            {/* Dynamic Tab 3: AI Neural Coach Simulation */}
            {activePreviewTab === "aicoach" && (
              <div style={{ padding: 24, background: "#0F172A", color: "#FFFFFF", display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#4F46E5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Brain size={16} color="#fff" />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800 }}>Train AI Neural Coach</div>
                    <div style={{ fontSize: 11, color: "#94A3B8" }}>Analyzing React 19 Server Actions Code Exercise</div>
                  </div>
                </div>

                <div style={{ background: "#1E293B", padding: 14, borderRadius: 12, fontSize: 13, color: "#E2E8F0", lineHeight: 1.5, border: "1px solid rgba(255,255,255,0.1)" }}>
                  "Great implementation of the form action! To optimize for multi-modal latency, let's wrap the vector search query inside a Suspense boundary. Here is a 3-question evaluation quiz to verify the pattern:"
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ background: "rgba(99,102,241,0.25)", color: "#A5B4FC", padding: "4px 10px", borderRadius: 8, fontSize: 11.5, fontWeight: 700 }}>+50 XP Earned</span>
                  <span style={{ background: "rgba(16,185,129,0.25)", color: "#6EE7B7", padding: "4px 10px", borderRadius: 8, fontSize: 11.5, fontWeight: 700 }}>Mastery: 94%</span>
                </div>
              </div>
            )}

          </div>

        </div>
      </section>

      {/* =========================================================================
          DYNAMIC MOVING PARTNER & TECH TICKER
          ========================================================================= */}
      <section style={{ borderTop: "1px solid #E2E8F0", borderBottom: "1px solid #E2E8F0", background: "#FFFFFF", padding: "18px 0", overflow: "hidden" }}>
        <div className="lp-ticker-track">
          {[...PARTNERS, ...PARTNERS].map((item, idx) => (
            <div key={idx} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "0 28px", fontSize: 13.5, fontWeight: 800, color: "#475569" }}>
              <Sparkles size={14} color="#4F46E5" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>

      {/* =========================================================================
          CURATED CAREER PATHWAYS & COURSE SHOWCASE
          ========================================================================= */}
      <section id="tracks" className="lp-section" style={{ ...styles.section, background: "#F8FAFC" }}>
        <div style={styles.sectionInner}>
          <div style={styles.sectionTag}><Compass size={13} color="#4F46E5" /> Job-Ready Pathways</div>
          <h2 className="lp-section-h2" style={styles.sectionH2}>Explore Industry-Standard Career Tracks</h2>
          <p style={styles.sectionSub}>Structured multi-course roadmaps designed by industry architects for verified job readiness.</p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 22, textAlign: "left" }}>
            {PREVIEW_TRACKS.map(track => (
              <div
                key={track.id}
                className="lp-card"
                style={{
                  background: "#FFFFFF",
                  borderRadius: 20,
                  border: "1px solid #E2E8F0",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  cursor: "pointer"
                }}
                onClick={() => setSelectedTrackModal(track)}
              >
                <div style={{ position: "relative", height: 160, width: "100%", overflow: "hidden" }}>
                  <img src={track.image} alt={track.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(15,23,42,0.85) 0%, transparent 60%)" }} />
                  <div style={{ position: "absolute", top: 12, left: 12, background: "rgba(79,70,229,0.9)", color: "#FFFFFF", fontSize: 10.5, fontWeight: 800, padding: "3px 8px", borderRadius: 6 }}>
                    {track.badge}
                  </div>
                  <div style={{ position: "absolute", bottom: 10, left: 14, right: 14, color: "#fff", display: "flex", justifyContent: "space-between", fontSize: 11.5, fontWeight: 700 }}>
                    <span>{track.hours}</span>
                    <span style={{ color: "#FDE68A" }}>★ {track.rating}</span>
                  </div>
                </div>

                <div style={{ padding: "18px 20px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#4F46E5", textTransform: "uppercase", marginBottom: 6 }}>{track.category}</div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: "0 0 10px", lineHeight: 1.35 }}>{track.title}</h3>
                    
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                      {track.skills.slice(0, 3).map((s, i) => (
                        <span key={i} style={{ background: "#F1F5F9", color: "#475569", fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 6 }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTop: "1px solid #E2E8F0" }}>
                    <span style={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>{track.enrolled}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: "#4F46E5", display: "flex", alignItems: "center", gap: 4 }}>
                      Preview Track <ArrowRight size={13} />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================================
          THE PROBLEM SECTION
          ========================================================================= */}
      <section className="lp-section" style={{ ...styles.section, background: "#FFFFFF" }}>
        <div style={styles.sectionInner}>
          <div style={styles.sectionTag}><AlertTriangle size={13} color="#4F46E5" /> The Core Problem</div>
          <h2 className="lp-section-h2" style={styles.sectionH2}>Your teams are training. You still can't see what's working.</h2>
          <p style={styles.sectionSub}>
            Courses get assigned, seats get filled, certificates get generated — yet leadership still doesn't know who is actually ready to deliver on production deadlines.
          </p>

          <div style={styles.statBanner}>
            Traditional online courses lose <strong>80–85%</strong> of enterprise learners before completion, creating a multi-million dollar capability blindspot.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 22, textAlign: "left" }}>
            {PROBLEM_POINTS.map((p) => {
              const Icon = p.icon;
              return (
                <div key={p.title} className="lp-card" style={styles.card}>
                  <div style={{ ...styles.cardIcon, background: "rgba(239,68,68,.1)" }}><Icon size={20} color="#EF4444" /></div>
                  <span style={{ fontSize: 10.5, fontWeight: 800, color: "#EF4444", letterSpacing: ".04em" }}>{p.badge}</span>
                  <h3 style={{ ...styles.cardTitle, marginTop: 4 }}>{p.title}</h3>
                  <p style={styles.cardDesc}>{p.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =========================================================================
          5 INTELLIGENCE LAYERS BENTO GRID
          ========================================================================= */}
      <section id="platform" className="lp-section" style={styles.section}>
        <div style={styles.sectionInner}>
          <div style={styles.sectionTag}><Layers size={13} color="#4F46E5" /> Platform Architecture</div>
          <h2 className="lp-section-h2" style={styles.sectionH2}>One Operating System. Five Intelligence Layers.</h2>
          <p style={styles.sectionSub}>
            Train AI replaces fragmented course catalogs, spreadsheets, and sync meetings with an intelligent system that models how your workforce grows.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20, textAlign: "left" }}>
            {INTELLIGENCE_LAYERS.map((l) => {
              const Icon = l.icon;
              return (
                <div key={l.letter} className="lp-card" style={{ ...styles.card, padding: 0, overflow: "hidden" }}>
                  <div style={{ position: "relative", height: 120, width: "100%", overflow: "hidden" }}>
                    <img src={l.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(15,23,42,0.85) 0%, transparent 60%)" }} />
                    <div style={{ position: "absolute", bottom: 10, left: 14, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: "#4F46E5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Icon size={16} color="#fff" />
                      </div>
                      <span style={{ fontWeight: 800, fontSize: 14 }}>{l.letter}</span>
                    </div>
                  </div>
                  <div style={{ padding: "16px 20px" }}>
                    <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", margin: "0 0 6px" }}>{l.title}</h3>
                    <p style={{ fontSize: 12.5, color: "#64748B", margin: 0, lineHeight: 1.45 }}>{l.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =========================================================================
          TRADITIONAL LMS VS TRAIN AI MATRIX
          ========================================================================= */}
      <section id="why-train-ai" className="lp-section" style={{ ...styles.section, background: "#FFFFFF" }}>
        <div style={styles.sectionInner}>
          <div style={styles.sectionTag}><HelpCircle size={13} color="#4F46E5" /> Unmatched Differentiation</div>
          <h2 className="lp-section-h2" style={styles.sectionH2}>Traditional Video LMS vs. Train AI Operating System</h2>

          <div style={{ overflowX: "auto", marginTop: 24 }}>
            <table style={styles.comparisonTable}>
              <thead>
                <tr>
                  <th style={styles.comparisonHeaderCell}>Core Capability</th>
                  <th style={styles.comparisonHeaderCell}>Traditional Video LMS (Coursera/Udemy)</th>
                  <th style={{ ...styles.comparisonHeaderCell, color: "#4F46E5", background: "#EEF2FF" }}>Train AI Workforce Platform</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.dimension}>
                    <td style={styles.comparisonCellLabel}>{row.dimension}</td>
                    <td style={styles.comparisonCell}>{row.lms}</td>
                    <td style={{ ...styles.comparisonCell, fontWeight: 800, color: "#4F46E5", background: "#FAF5FF" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <Check size={15} color="#10B981" /> {row.trainai}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* =========================================================================
          PRICING PLANS
          ========================================================================= */}
      <section id="pricing" className="lp-section" style={styles.section}>
        <div style={styles.sectionInner}>
          <div style={styles.sectionTag}><ShieldCheck size={13} color="#4F46E5" /> Pricing Plans</div>
          <h2 className="lp-section-h2" style={styles.sectionH2}>Transparent Tiers Built for Measurable Value</h2>
          <p style={styles.sectionSub}>No hidden fees. Scale smoothly from a single squad to entire multi-thousand employee divisions.</p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24, textAlign: "left", marginTop: 24 }}>
            {PRICING_TIERS.map((tier) => (
              <div
                key={tier.name}
                className="lp-card"
                style={{
                  ...styles.pricingCard,
                  border: tier.highlighted ? "2.5px solid #4F46E5" : "1px solid #E2E8F0",
                  boxShadow: tier.highlighted ? "0 22px 48px -12px rgba(79,70,229,.3)" : "0 4px 16px rgba(15,23,42,0.03)"
                }}
              >
                {tier.highlighted && <div style={styles.pricingBadge}>★ MOST POPULAR</div>}
                <h3 style={styles.pricingName}>{tier.name}</h3>
                <p style={styles.pricingTagline}>{tier.tagline}</p>
                <div style={{ fontSize: 26, fontWeight: 900, color: "#0F172A", marginBottom: 2 }}>{tier.price}</div>
                <p style={{ fontSize: 11.5, color: "#94A3B8", margin: "0 0 18px" }}>{tier.priceNote}</p>
                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                  {tier.features.map((f) => (
                    <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12.5, color: "#334155", lineHeight: 1.4 }}>
                      <CheckCircle2 size={15} color="#10B981" style={{ flexShrink: 0, marginTop: 2 }} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  className="action-btn"
                  style={tier.highlighted ? styles.getStartedBtn : styles.secondaryBtn}
                  onClick={() => handleNav("book-demo")}
                >
                  Speak with our team <ArrowRight size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================================
          FAQ ACCORDION
          ========================================================================= */}
      <section className="lp-section" style={{ ...styles.section, background: "#FFFFFF" }}>
        <div style={{ ...styles.sectionInner, maxWidth: 740 }}>
          <div style={styles.sectionTag}><HelpCircle size={13} color="#4F46E5" /> FAQ</div>
          <h2 className="lp-section-h2" style={styles.sectionH2}>Frequently asked questions</h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, textAlign: "left", marginTop: 24 }}>
            {FAQ_ITEMS.map((item, i) => {
              const isOpen = openFaq === i;
              return (
                <div key={item.q} style={styles.faqItem}>
                  <button
                    type="button"
                    style={styles.faqQuestion}
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    aria-expanded={isOpen}
                  >
                    <span>{item.q}</span>
                    <ChevronDown
                      className="lp-faq-chevron"
                      size={18}
                      color="#64748B"
                      style={{ flexShrink: 0, transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
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
          INTERACTIVE DEMO TERMINAL
          ========================================================================= */}
      <section id="book-demo" className="lp-section" style={styles.ctaSection}>
        <div style={{ ...styles.sectionInner, maxWidth: 640 }}>
          <h2 className="lp-section-h2" style={{ ...styles.sectionH2, color: "#FFFFFF" }}>
            Schedule Your Live Platform Demo
          </h2>
          <p style={{ ...styles.sectionSub, color: "rgba(255,255,255,0.85)", marginBottom: 28 }}>
            Experience live workforce skill mapping, AI coaching, and custom organizational pathways in a 20-minute tailored walkthrough.
          </p>

          <div style={styles.waitlistCard}>
            {demoSubmitted ? (
              <div style={styles.successBox}>
                <CheckCircle2 size={22} color="#10B981" />
                <span>Thank you! We will reach out to schedule your live demo shortly.</span>
              </div>
            ) : (
              <form onSubmit={handleDemoSubmit} style={styles.demoForm}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                  <div style={styles.demoInputWrap}>
                    <Users size={14} color="#94A3B8" style={styles.demoInputIcon} />
                    <input
                      required placeholder="Full name" value={demoName}
                      onChange={(e) => setDemoName(e.target.value)}
                      style={styles.demoInput}
                    />
                  </div>
                  <div style={styles.demoInputWrap}>
                    <Building2 size={14} color="#94A3B8" style={styles.demoInputIcon} />
                    <input
                      required placeholder="Company / Organization" value={demoCompany}
                      onChange={(e) => setDemoCompany(e.target.value)}
                      style={styles.demoInput}
                    />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                  <div style={styles.demoInputWrap}>
                    <Globe size={14} color="#94A3B8" style={styles.demoInputIcon} />
                    <input
                      type="email" required placeholder="Work email" value={demoEmail}
                      onChange={(e) => setDemoEmail(e.target.value)}
                      style={styles.demoInput}
                    />
                  </div>
                  <div style={styles.demoInputWrap}>
                    <select
                      value={demoTeamSize} onChange={(e) => setDemoTeamSize(e.target.value)}
                      style={{ ...styles.demoInput, paddingLeft: 14 }}
                    >
                      {TEAM_SIZE_OPTIONS.map((t) => <option key={t} value={t}>{t} employees</option>)}
                    </select>
                  </div>
                </div>
                <textarea
                  placeholder="Tell us about your team's learning goals or challenges (optional)"
                  value={demoMessage} onChange={(e) => setDemoMessage(e.target.value)}
                  rows={2} style={styles.demoTextarea}
                />
                <button type="submit" disabled={submitting} className="action-btn" style={styles.submitBtn}>
                  {submitting ? "Submitting..." : "Schedule Live Demo"} <ArrowRight size={16} />
                </button>
                {demoError && <div style={styles.errorText}>{demoError}</div>}
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Modern Footer */}
      <footer style={styles.footer}>
        <div style={styles.footerInner}>
          <div style={{ minWidth: 200 }}>
            <img src="/train-ai-logo.png" alt="Train AI" style={{ height: 40, width: "auto", objectFit: "contain", display: "block", marginBottom: 10 }} />
            <div style={{ fontSize: 12.5, color: "#64748B" }}>Train AI Limited · Lagos · London</div>
            <div style={{ fontSize: 12.5, color: "#64748B", marginTop: 4 }}>info@trainailtd.com</div>
            <div style={{ fontSize: 12.5, color: "#64748B", marginTop: 2 }}>+44 7435126104 · +234 9076664049</div>
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
            <strong style={{ color: "#0F172A", marginBottom: 4 }}>Platform</strong>
            <span className="lp-footer-link" onClick={() => handleNav("platform")}>Workforce Intelligence</span>
            <span className="lp-footer-link" onClick={() => handleNav("tracks")}>Career Tracks</span>
            <span className="lp-footer-link" onClick={() => handleNav("solutions")}>Solutions &amp; Academies</span>
            <span className="lp-footer-link" onClick={() => handleNav("why-train-ai")}>Why Train AI</span>
            <span className="lp-footer-link" onClick={() => handleNav("pricing")}>Pricing Plans</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
            <strong style={{ color: "#0F172A", marginBottom: 4 }}>Company &amp; Legal</strong>
            <span className="lp-footer-link" onClick={() => handleNav("about")}>About Us</span>
            <span className="lp-footer-link" onClick={() => handleNav("privacy")}>Privacy Policy</span>
            <span className="lp-footer-link" onClick={() => handleNav("terms")}>Terms of Service</span>
            <span className="lp-footer-link" onClick={() => handleNav("cookie")}>Cookie Policy</span>
          </div>
        </div>
      </footer>

      {/* Legal Modals */}
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

      {/* Track Preview Modal */}
      {selectedTrackModal && (
        <div style={styles.modalOverlay} onClick={() => setSelectedTrackModal(null)} role="presentation">
          <div style={{ ...styles.modalCard, maxWidth: 540 }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div style={{ position: "relative", height: 160, borderRadius: 14, overflow: "hidden", marginBottom: 16 }}>
              <img src={selectedTrackModal.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(15,23,42,0.85) 0%, transparent 60%)" }} />
              <div style={{ position: "absolute", bottom: 12, left: 14, right: 14, color: "#fff" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#A5B4FC" }}>{selectedTrackModal.category}</div>
                <div style={{ fontSize: 16, fontWeight: 900 }}>{selectedTrackModal.title}</div>
              </div>
            </div>
            <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.5, marginBottom: 16 }}>
              Included competencies: {selectedTrackModal.skills.join(" • ")}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button className="action-btn" style={styles.secondaryBtn} onClick={() => setSelectedTrackModal(null)}>Close</button>
              <button className="action-btn" style={styles.getStartedBtn} onClick={() => { setSelectedTrackModal(null); handleNav("book-demo"); }}>
                Enroll in Track →
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

const styles = {
  outer: { minHeight: "100vh", background: "#F8FAFC", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
  header: { background: "rgba(255,255,255,0.92)", backdropFilter: "blur(12px)", borderBottom: "1px solid #E2E8F0", position: "sticky", top: 0, zIndex: 60 },
  headerInner: { maxWidth: 1140, margin: "0 auto", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" },
  navLink: { fontSize: 14, fontWeight: 600, color: "#334155" },
  signInBtn: { border: "1.5px solid #E2E8F0", background: "#FFFFFF", padding: "8px 16px", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer", color: "#0F172A" },
  getStartedBtn: { border: "none", background: "linear-gradient(135deg, #4338CA 0%, #4F46E5 50%, #6366F1 100%)", color: "#FFFFFF", padding: "9px 18px", borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: "pointer", boxShadow: "0 4px 14px rgba(79,70,229,0.35)", display: "inline-flex", alignItems: "center", gap: 6 },
  secondaryBtn: { border: "1.5px solid #E2E8F0", background: "#FFFFFF", color: "#0F172A", padding: "9px 18px", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 },
  section: { padding: "70px 20px" },
  sectionInner: { maxWidth: 1100, margin: "0 auto", textAlign: "center" },
  sectionTag: { display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 14px", borderRadius: 99, background: "#EEF2FF", color: "#4F46E5", fontSize: 12, fontWeight: 800, marginBottom: 16 },
  sectionH2: { fontSize: 30, fontWeight: 900, letterSpacing: "-0.025em", color: "#0F172A", margin: "0 0 10px", lineHeight: 1.2 },
  sectionSub: { fontSize: 15, color: "#64748B", maxWidth: 640, margin: "0 auto 36px", lineHeight: 1.55 },
  statBanner: { maxWidth: 680, margin: "0 auto 36px", padding: "16px 20px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 14, fontSize: 14, color: "#991B1B", lineHeight: 1.5 },
  card: { background: "#FFFFFF", padding: 22, borderRadius: 18, border: "1px solid #E2E8F0" },
  cardIcon: { width: 40, height: 40, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  cardTitle: { fontSize: 15.5, fontWeight: 800, margin: "0 0 6px", color: "#0F172A" },
  cardDesc: { fontSize: 13, color: "#64748B", margin: 0, lineHeight: 1.45 },
  comparisonTable: { width: "100%", borderCollapse: "collapse", background: "#FFFFFF", borderRadius: 14, overflow: "hidden", border: "1px solid #E2E8F0" },
  comparisonHeaderCell: { textAlign: "left", padding: "14px 18px", fontSize: 13, fontWeight: 800, color: "#64748B", borderBottom: "1px solid #E2E8F0", background: "#F8FAFC" },
  comparisonCellLabel: { textAlign: "left", padding: "14px 18px", fontSize: 13.5, fontWeight: 700, color: "#0F172A", borderBottom: "1px solid #E2E8F0" },
  comparisonCell: { textAlign: "left", padding: "14px 18px", fontSize: 13, color: "#64748B", borderBottom: "1px solid #E2E8F0" },
  pricingCard: { position: "relative", background: "#FFFFFF", padding: 26, borderRadius: 20, display: "flex", flexDirection: "column" },
  pricingBadge: { position: "absolute", top: -12, left: 20, background: "linear-gradient(135deg, #4338CA, #6366F1)", color: "#FFFFFF", fontSize: 11, fontWeight: 800, padding: "4px 12px", borderRadius: 99 },
  pricingName: { fontSize: 19, fontWeight: 800, margin: "6px 0 4px", color: "#0F172A" },
  pricingTagline: { fontSize: 13, color: "#64748B", margin: "0 0 16px", lineHeight: 1.45, minHeight: 48 },
  faqItem: { background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 14, padding: "4px 18px" },
  faqQuestion: { width: "100%", border: "none", background: "transparent", cursor: "pointer", padding: "14px 0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, fontSize: 14.5, fontWeight: 800, color: "#0F172A", textAlign: "left" },
  ctaSection: { padding: "70px 20px", background: "linear-gradient(135deg, #0F172A 0%, #1E1B4B 50%, #312E81 100%)" },
  waitlistCard: { background: "#FFFFFF", padding: 24, borderRadius: 20, border: "1px solid #E2E8F0", boxShadow: "0 20px 40px -16px rgba(15,23,42,.12)" },
  demoForm: { display: "flex", flexDirection: "column", gap: 12 },
  demoInputWrap: { position: "relative", flex: 1 },
  demoInputIcon: { position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" },
  demoInput: { width: "100%", border: "1.5px solid #E2E8F0", padding: "10px 14px 10px 34px", fontSize: 13.5, borderRadius: 10, outline: "none", boxSizing: "border-box", color: "#0F172A", background: "#F8FAFC" },
  demoTextarea: { width: "100%", border: "1.5px solid #E2E8F0", padding: "10px 14px", fontSize: 13.5, borderRadius: 10, outline: "none", boxSizing: "border-box", color: "#0F172A", resize: "vertical", fontFamily: "inherit", background: "#F8FAFC" },
  submitBtn: { border: "none", background: "linear-gradient(135deg, #4338CA 0%, #4F46E5 50%, #6366F1 100%)", color: "#FFFFFF", padding: "12px 20px", borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, boxShadow: "0 4px 14px rgba(79,70,229,0.35)" },
  errorText: { fontSize: 12, color: "#EF4444", fontWeight: 700, textAlign: "left" },
  successBox: { display: "flex", alignItems: "center", gap: 10, padding: "16px", fontSize: 14, fontWeight: 700, color: "#10B981", background: "#ECFDF5", borderRadius: 12 },
  footer: { borderTop: "1px solid #E2E8F0", background: "#FFFFFF", padding: "36px 20px" },
  footerInner: { maxWidth: 1140, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 32 },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 100 },
  modalCard: { background: "#FFFFFF", borderRadius: 20, padding: 26, maxWidth: 480, width: "100%", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 30px 60px -24px rgba(15,23,42,.35)" },
  modalClose: { border: "none", background: "#F1F5F9", borderRadius: 8, padding: 6, cursor: "pointer", display: "flex", color: "#64748B" }
};
