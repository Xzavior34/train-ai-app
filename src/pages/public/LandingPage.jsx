import React, { useState, useEffect } from "react";
import {
  ArrowRight, BookOpen, GraduationCap, Cpu, ShieldCheck, CheckCircle2, Globe, X,
  Brain, Layers, ChevronDown, HelpCircle, ClipboardList, UserPlus, Rocket,
  Building2, Users, Target, TrendingUp, AlertTriangle, Eye, Lock, Compass, BarChart3,
  GitCompare, Table, School, Handshake, Briefcase, Zap, Sparkles, Flame, Menu, Check
} from "lucide-react";
import { submitDemoRequest, submitOrganizationInquiry, captureAttributionFromURL } from "../../lib/api/waitlist.js";
import { trackReferralClickIfPresent } from "../../lib/api/organizations.js";

const TEAM_SIZE_OPTIONS = ["1–50", "51–200", "201–1,000", "1,000+"];

const LEGAL_CONTENT = {
  about: {
    title: "About Us",
    body: "Train AI is an AI-powered learning operating system that gives organizations a live map of their workforce's skills, connecting learners, facilitators, and content into personalised, outcome-driven pathways. We help companies close skill gaps before they become delivery problems."
  },
  privacy: {
    title: "Privacy Policy",
    body: "Our full Privacy Policy is being finalized. In short: we only collect the data needed to run your account (profile, course progress, and communications you send us), we never sell personal data, and you can request an export or deletion of your data at any time by emailing hello@trainailtd.com."
  },
  terms: {
    title: "Terms of Service",
    body: "Our full Terms of Service are being finalized. In short: Train AI is provided as-is; accounts are personal and non-transferable (or managed by your organisation's admin, if you were invited by one); and we may update these terms as the platform evolves. Questions: hello@trainailtd.com."
  },
  cookie: {
    title: "Cookie Policy",
    body: "We use strictly necessary cookies to keep you signed in. Any analytics or marketing cookies are off by default and only load after you explicitly opt in. Questions: hello@trainailtd.com."
  }
};

const PROBLEM_POINTS = [
  {
    icon: Eye,
    title: "You've lost visibility",
    desc: "You know your teams are \u201Cin training.\u201D You don't know who's actually building the skills you're paying for, or when they'll be ready to use them."
  },
  {
    icon: GitCompare,
    title: "Your teams are out of sync",
    desc: "Learning lives in one tool, performance in another, and skills data in neither. By the time a gap shows up in a project, it's already too late to close it."
  },
  {
    icon: AlertTriangle,
    title: "You're finding out too late",
    desc: "78% of organizations abandon digital projects not for lack of budget, but for lack of the right skills, spotted after the deadline was already at risk."
  }
];

const INTELLIGENCE_LAYERS = [
  { icon: BookOpen, letter: "Learn", desc: "Adaptive learning paths that build the exact skill, for the exact role, at the exact time it's needed." },
  { icon: TrendingUp, letter: "Perform", desc: "Live visibility into who's on track, who's stuck, and who's ready for what's next." },
  { icon: Users, letter: "Develop", desc: "Structured growth through mentors or instructors, cohorts, and career paths that turn training into a real talent pipeline." },
  { icon: BarChart3, letter: "Measure", desc: "Real-time dashboards and analytics that turn learning activity into decisions leadership can act on." },
  { icon: Cpu, letter: "Automate", desc: "AI that personalises paths, flags risk, and writes the report, so your team spends less time managing training and more time using what it reveals." }
];

const HOW_IT_WORKS = [
  { icon: UserPlus, title: "Onboard your team", desc: "Bring your people in, link their roles and goals, and Train AI pairs each of them with an AI coach tailored to what they need to learn most." },
  { icon: Target, title: "Assign learning paths", desc: "Every employee gets an AI-personalised path, matched to their role, pace, and the gaps that matter most to your business." },
  { icon: TrendingUp, title: "Track skill growth", desc: "Watch skills develop in real time, not in a report that lands a month after the fact." },
  { icon: Rocket, title: "Act on insights", desc: "Spot the gaps, flag the risks, and know exactly who's ready for what's next, before it becomes a delivery problem." }
];

const SOLUTIONS = [
  { icon: GraduationCap, title: "Graduate and Early-Career Programmes", desc: "Onboard talent at scale, track progress, and reduce time to competence." },
  { icon: Briefcase, title: "Leadership Academies", desc: "Build leadership capability with structured cohorts, mentors, and readiness tracking." },
  { icon: ShieldCheck, title: "Compliance and Regulated Training", desc: "Keep mandatory learning visible, auditable, and easy to manage." },
  { icon: Cpu, title: "Digital Transformation and AI Upskilling", desc: "Close digital skill gaps before they become delivery problems." },
  { icon: School, title: "Universities and Foundations", desc: "Support cohorts, mentorship, and structured learning communities." },
  { icon: Handshake, title: "NGOs and Development Programmes", desc: "Track learning impact across distributed learner groups and partners." }
];

const WHY_QUESTIONS = [
  "Who is actually ready?",
  "What skills are improving?",
  "Where are our most important gaps?",
  "Which teams need support now?",
  "Who should be promoted or developed next?",
  "What value did learning create for the business?"
];

const WHY_FEATURES = [
  { icon: Compass, title: "AI Skill Graph", desc: "A live map of every skill in your organization: who has it, who's building it, and where the real gaps are.", answers: "\u201CDo we actually have the skills to ship this project?\u201D" },
  { icon: BarChart3, title: "Workforce Intelligence Dashboard with Readiness Score", desc: "Skill gaps and a readiness score, department by department, in one view built for decision-makers, not just admins.", answers: "\u201CWho should we be promoting, and who's at risk?\u201D" },
  { icon: Brain, title: "AI Support for Employees", desc: "AI coach, quiz generator, and tailored AI insights, with access to courses.", answers: "\u201CWill my team get curated support for their development?\u201D" },
  { icon: ShieldCheck, title: "Certificates & Compliance", desc: "Verifiable certificates and audit-ready compliance tracking, tied directly to the same dashboards, so your training record and your readiness data are never two different stories.", answers: null }
];

const COMPARISON_ROWS = [
  { dimension: "Focus", lms: "Course completion", trainai: "Workforce readiness" },
  { dimension: "Data", lms: "Enrolment and completion logs", trainai: "Live skill graph and readiness scores" },
  { dimension: "Output", lms: "Certificates", trainai: "Certificates plus decision-ready intelligence" },
  { dimension: "Audience", lms: "L&D admins", trainai: "Executives, managers, and L&D" }
];

const ORG_FEATURES = [
  { icon: Layers, title: "Cohort Management", desc: "Group learners into cohorts, assign instructors, and run structured programs (onboarding, leadership tracks, compliance training) without juggling five tools." },
  { icon: BarChart3, title: "Organization Dashboards", desc: "One dashboard for executives, one for managers, one for admins, each showing exactly what that person needs to make a decision." },
  { icon: BookOpen, title: "Course Management", desc: "Upload your content and manage completion rates and progress analytics across cohorts and teams." },
  { icon: ShieldCheck, title: "GDPR & Enterprise Compliance", desc: "Append-only audit logging, DSAR data exports, consent mode, and renewal reminders handled automatically, so compliance stops being a spreadsheet fire drill." },
  { icon: Users, title: "Manager & Instructor Views", desc: "Every manager becomes a talent developer, with a live view of their team's progress, without adding headcount to your L&D function." }
];

const INDIVIDUAL_FEATURES = [
  { icon: Brain, title: "AI Learning Coach", desc: "A 24/7 conversational tutor that explains, quizzes, and answers anything you're stuck on." },
  { icon: BookOpen, title: "Real courses, curated", desc: "No content overload. Just the resources that move you toward your goal." },
  { icon: Users, title: "A community, not a login", desc: "Cohorts, peer accountability, and mentors, so you're never learning alone." }
];

const PRICING_TIERS = [
  {
    name: "Starter",
    tagline: "For teams just getting started with structured learning. Core platform, per-user pricing, no long-term commitment.",
    price: "Custom",
    priceNote: "Per user • No long-term commitment",
    features: [
      "Full learner experience: AI Coach, AI Insights, Quiz Generator",
      "Cohorts, courses, assessments, certificates",
      "Organisation dashboard for a single team",
    ],
    highlighted: false,
  },
  {
    name: "Growth",
    tagline: "For organizations scaling cohorts across departments, with volume pricing as you onboard more of your team.",
    price: "Volume",
    priceNote: "Tiered pricing as headcount grows",
    features: [
      "Everything in Starter, plus:",
      "Department-level dashboards and manager access",
      "Live Skill Graph and Workforce Readiness Scores",
      "Automated compliance tracking and audit export",
      "Dedicated account manager and onboarding support"
    ],
    highlighted: true,
  },
  {
    name: "Enterprise",
    tagline: "For large organizations with complex compliance, procurement, or custom integration needs.",
    price: "Enterprise",
    priceNote: "Annual contract with tailored SLAs",
    features: [
      "Everything in Growth, plus:",
      "Custom role-to-skill frameworks",
      "SSO and LMS/HRIS data integrations",
      "White-label branding and custom domain",
      "Custom data retention and on-prem deployment options",
      "Executive quarterly talent reviews with our advisory team"
    ],
    highlighted: false,
  }
];

const FAQ_ITEMS = [
  {
    q: "How does Train AI differ from a traditional LMS like Coursera or Udemy?",
    a: "Traditional LMS platforms measure course completion: whether a learner watched a video or took a quiz. Train AI measures workforce readiness: whether your people actually have the skills to deliver on projects, mapped live across your entire organization with AI skill graphs."
  },
  {
    q: "Can we upload our own proprietary training content?",
    a: "Yes. Train AI supports internal courses, SCORM packages, interactive lessons, custom quizzes, and external partner curriculum, all tracked in the same unified readiness dashboard."
  },
  {
    q: "How does the AI Coach work?",
    a: "Every learner has access to a 24/7 conversational AI learning tutor that provides personalized explanations, generates practice quizzes, and recommends targeted lessons based on their individual skill gaps."
  },
  {
    q: "Is Train AI GDPR-compliant and enterprise-ready?",
    a: "Yes. Train AI includes append-only audit logging, DSAR data exports, strict role-based access control (RBAC), and enterprise data isolation."
  }
];

const INQUIRY_TYPE_OPTIONS = [
  { value: "procurement", label: "Enterprise Procurement" },
  { value: "partnership", label: "Academic / University Partnership" },
  { value: "custom", label: "Custom Integration / Feature Request" },
  { value: "general", label: "General Sales Inquiry" }
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

  useEffect(() => {
    if (!activeModal) return;
    function handleKeyDown(e) {
      if (e.key === "Escape") setActiveModal(null);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activeModal]);

  const [contactMode, setContactMode] = useState("demo");
  const [inquiryType, setInquiryType] = useState(INQUIRY_TYPE_OPTIONS[0].value);
  const [inquirySubmitted, setInquirySubmitted] = useState(false);
  const [inquiryError, setInquiryError] = useState("");

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

  async function handleInquirySubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setInquiryError("");
    try {
      const result = await submitOrganizationInquiry({
        fullName: demoName,
        workEmail: demoEmail,
        companyName: demoCompany,
        inquiryType,
        message: demoMessage,
        source: "landing_page",
      });
      if (!result.success) {
        setInquiryError(result.error || "Could not submit your inquiry. Please try again.");
        return;
      }
      setInquirySubmitted(true);
    } catch (err) {
      console.warn("Organization inquiry failed:", err);
      setInquiryError("Something went wrong. Please try again, or email info@trainailtd.com.");
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
    if (["platform", "solutions", "why-train-ai", "pricing", "individuals", "book-demo", "organizations"].includes(target)) {
      scrollToId(target);
      return;
    }
    onNavigate(target);
  }

  return (
    <div style={styles.outer}>
      <style>{`
        @keyframes heroPop { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
        .hero-anim { animation: heroPop .4s ease both; }
        .action-btn { transition: transform .15s ease, box-shadow .15s ease; }
        .action-btn:hover { transform: translateY(-1px); box-shadow: 0 12px 28px -4px rgba(79, 70, 229, 0.45); }
        .action-btn:active { transform: scale(.97); }

        .lp-card { transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease; }
        .lp-card:hover { transform: translateY(-3px); box-shadow: 0 14px 32px -10px rgba(15,23,42,.12); border-color: #C7D2FE; }

        .lp-nav-link { transition: color .15s ease; cursor: pointer; }
        .lp-nav-link:hover { color: #4F46E5 !important; }
        .lp-footer-link { transition: color .15s ease; cursor: pointer; }
        .lp-footer-link:hover { color: #4F46E5 !important; }
        .lp-faq-chevron { transition: transform .2s ease; }
        .lp-question-pill { transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease; }
        .lp-question-pill:hover { transform: translateY(-2px); box-shadow: 0 6px 16px -6px rgba(15,23,42,.1); border-color: #C7D2FE; }
        
        .lp-demo-form input, .lp-demo-form select, .lp-demo-form textarea { transition: border-color .15s ease, box-shadow .15s ease; }
        .lp-demo-form input:focus, .lp-demo-form select:focus, .lp-demo-form textarea:focus { border-color: #4F46E5 !important; box-shadow: 0 0 0 3px rgba(79,70,229,.12); }

        @media (max-width: 820px) {
          .lp-desktop-nav { display: none !important; }
          .lp-mobile-menu-btn { display: flex !important; }
        }
        @media (min-width: 821px) {
          .lp-mobile-drawer { display: none !important; }
          .lp-mobile-menu-btn { display: none !important; }
        }
        @media (max-width: 600px) {
          .lp-hero-h1 { font-size: 28px !important; }
          .lp-hero-sub { font-size: 14px !important; }
          .lp-section-h2 { font-size: 22px !important; }
          .lp-section { padding: 48px 16px !important; }
          .lp-mockup-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* Sticky Header */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          
          {/* Brand Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => handleNav("home")}>
            <img src="/train-ai-logo.png" alt="Train AI" style={{ height: 44, width: "auto", objectFit: "contain", display: "block" }} />
          </div>

          {/* Desktop Navigation Links */}
          <nav className="lp-desktop-nav" style={{ display: "flex", gap: 24, alignItems: "center" }}>
            <span className="lp-nav-link" style={styles.navLink} onClick={() => handleNav("platform")}>Platform</span>
            <span className="lp-nav-link" style={styles.navLink} onClick={() => handleNav("solutions")}>Solutions</span>
            <span className="lp-nav-link" style={styles.navLink} onClick={() => handleNav("why-train-ai")}>Why Train AI</span>
            <span className="lp-nav-link" style={styles.navLink} onClick={() => handleNav("pricing")}>Pricing</span>
            <span className="lp-nav-link" style={{ ...styles.navLink, color: "#64748B" }} onClick={() => handleNav("individuals")}>For Individuals</span>
          </nav>

          {/* Action CTAs & Mobile Hamburger */}
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              className="action-btn"
              style={{ ...styles.signInBtn, display: "inline-flex" }}
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

            {/* Mobile Menu Button */}
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
          <div className="lp-mobile-drawer" style={{ background: "#FFFFFF", borderTop: "1px solid #E2E8F0", padding: "16px 20px 24px", display: "flex", flexDirection: "column", gap: 12, boxShadow: "0 10px 25px rgba(0,0,0,0.05)" }}>
            <span className="lp-nav-link" style={{ fontSize: 15, fontWeight: 700, padding: "8px 0" }} onClick={() => handleNav("platform")}>Platform</span>
            <span className="lp-nav-link" style={{ fontSize: 15, fontWeight: 700, padding: "8px 0" }} onClick={() => handleNav("solutions")}>Solutions</span>
            <span className="lp-nav-link" style={{ fontSize: 15, fontWeight: 700, padding: "8px 0" }} onClick={() => handleNav("why-train-ai")}>Why Train AI</span>
            <span className="lp-nav-link" style={{ fontSize: 15, fontWeight: 700, padding: "8px 0" }} onClick={() => handleNav("pricing")}>Pricing</span>
            <span className="lp-nav-link" style={{ fontSize: 15, fontWeight: 700, padding: "8px 0", color: "#4F46E5" }} onClick={() => handleNav("individuals")}>For Individuals</span>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <main className="hero-anim lp-section" style={{ maxWidth: 1140, margin: "0 auto", padding: "60px 20px 70px", textAlign: "center" }}>
        
        {/* Pulsing Pill Tag */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 99,
          background: "linear-gradient(135deg, #EEF2FF 0%, #F5F3FF 100%)", border: "1px solid #E0E7FF",
          color: "#4F46E5", fontSize: 12.5, fontWeight: 800, marginBottom: 20
        }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#4F46E5", display: "inline-block", boxShadow: "0 0 8px #6366F1" }} />
          <span>AI WORKFORCE INTELLIGENCE PLATFORM</span>
        </div>

        {/* Hero Title */}
        <h1 className="lp-hero-h1" style={{ fontSize: "clamp(30px, 4.2vw, 48px)", fontWeight: 900, letterSpacing: "-0.03em", color: "#0F172A", margin: "0 auto 16px", maxWidth: 840, lineHeight: 1.15 }}>
          Measure readiness,<br />
          <span style={{ background: "linear-gradient(135deg, #4338CA 0%, #4F46E5 50%, #6366F1 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            not completion.
          </span>
        </h1>

        {/* Hero Subtitle */}
        <p className="lp-hero-sub" style={{ fontSize: "clamp(15px, 1.8vw, 17.5px)", color: "#475569", maxWidth: 740, margin: "0 auto 28px", lineHeight: 1.55 }}>
          Train AI turns learning activity into decision-ready intelligence about workforce readiness, skill coverage and team capability — so you know who is ready, who is stuck, and where the gaps are.
        </p>

        {/* Dual CTAs */}
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 20 }}>
          <button className="action-btn" style={styles.getStartedBtn} onClick={() => handleNav("book-demo")}>
            Start with your organisation <ArrowRight size={16} />
          </button>
          <button className="action-btn" style={styles.secondaryBtn} onClick={() => handleNav("individuals")}>
            Explore for Individuals
          </button>
        </div>

        {/* 3 Metric Capability Cards */}
        <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 14, marginTop: 24 }}>
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", padding: "10px 18px", borderRadius: 14, textAlign: "left", boxShadow: "0 2px 8px rgba(15,23,42,0.03)" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A", display: "flex", alignItems: "center", gap: 6 }}>
              <Layers size={14} color="#4F46E5" /> Skill Graph
            </div>
            <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 2 }}>Held • developing • missing</div>
          </div>
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", padding: "10px 18px", borderRadius: 14, textAlign: "left", boxShadow: "0 2px 8px rgba(15,23,42,0.03)" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A", display: "flex", alignItems: "center", gap: 6 }}>
              <TrendingUp size={14} color="#4F46E5" /> Readiness Score
            </div>
            <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 2 }}>Team • function • org</div>
          </div>
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", padding: "10px 18px", borderRadius: 14, textAlign: "left", boxShadow: "0 2px 8px rgba(15,23,42,0.03)" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A", display: "flex", alignItems: "center", gap: 6 }}>
              <Zap size={14} color="#4F46E5" /> Live Signals
            </div>
            <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 2 }}>Assessments • progress</div>
          </div>
        </div>

        {/* Live Dashboard Mockup with High-Res Stock Photography */}
        <div style={{
          marginTop: 40, position: "relative", borderRadius: 24, overflow: "hidden",
          border: "1px solid #E2E8F0", background: "#FFFFFF",
          boxShadow: "0 24px 60px -12px rgba(79, 70, 229, 0.18), 0 8px 24px -4px rgba(15, 23, 42, 0.06)",
          textAlign: "left"
        }}>
          {/* Browser Bar */}
          <div style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#EF4444" }} />
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#F59E0B" }} />
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#10B981" }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B", marginLeft: 8 }}>app.trainailtd.com/workforce-intelligence</span>
            </div>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: "#4F46E5", background: "#EEF2FF", padding: "3px 10px", borderRadius: 8 }}>
              ⚡ Live Intelligence Signal
            </span>
          </div>

          {/* Mockup Content Grid */}
          <div className="lp-mockup-grid" style={{ padding: 24, background: "#F8FAFC", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
            
            {/* Left Card: Team Readiness Breakdown */}
            <div style={{ background: "#FFFFFF", borderRadius: 18, border: "1px solid #E2E8F0", padding: 22, boxShadow: "0 4px 16px rgba(15,23,42,0.04)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase" }}>WORKFORCE INTELLIGENCE</div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: "#0F172A", marginTop: 2 }}>Readiness by team</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#4F46E5", background: "#EEF2FF", padding: "2px 8px", borderRadius: 6 }}>Live</span>
              </div>

              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 16 }}>
                <span style={{ fontSize: 36, fontWeight: 900, color: "#0F172A" }}>71</span>
                <span style={{ fontSize: 13, color: "#64748B" }}>Organisation readiness</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#10B981" }}>+4 this month</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    <span style={{ color: "#334155" }}>Engineering</span>
                    <span style={{ color: "#4F46E5" }}>82 (+6)</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 99, background: "#EEF2FF", overflow: "hidden" }}>
                    <div style={{ width: "82%", height: "100%", background: "#4F46E5", borderRadius: 99 }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    <span style={{ color: "#334155" }}>Operations</span>
                    <span style={{ color: "#4F46E5" }}>74 (+3)</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 99, background: "#EEF2FF", overflow: "hidden" }}>
                    <div style={{ width: "74%", height: "100%", background: "#6366F1", borderRadius: 99 }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    <span style={{ color: "#334155" }}>Compliance</span>
                    <span style={{ color: "#4F46E5" }}>61 (-2)</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 99, background: "#EEF2FF", overflow: "hidden" }}>
                    <div style={{ width: "61%", height: "100%", background: "#818CF8", borderRadius: 99 }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    <span style={{ color: "#334155" }}>Sales &amp; Growth</span>
                    <span style={{ color: "#4F46E5" }}>55 (+9)</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 99, background: "#EEF2FF", overflow: "hidden" }}>
                    <div style={{ width: "55%", height: "100%", background: "#A5B4FC", borderRadius: 99 }} />
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 18, paddingTop: 14, borderTop: "1px solid #E2E8F0" }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#0F172A" }}>12</div>
                  <div style={{ fontSize: 11, color: "#64748B" }}>Skill gaps</div>
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#0F172A" }}>38</div>
                  <div style={{ fontSize: 11, color: "#64748B" }}>Compliance due</div>
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#0F172A" }}>6</div>
                  <div style={{ fontSize: 11, color: "#64748B" }}>Cohorts active</div>
                </div>
              </div>
            </div>

            {/* Right Card: High-Res Team Stock Image */}
            <div style={{
              borderRadius: 18, overflow: "hidden", position: "relative",
              border: "1px solid #E2E8F0", minHeight: 280,
              backgroundImage: "url('https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&fit=crop&q=80')",
              backgroundSize: "cover", backgroundPosition: "center",
              display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 20
            }}>
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(15,23,42,0.88) 0%, rgba(15,23,42,0.2) 60%, transparent 100%)" }} />
              <div style={{ position: "relative", color: "#FFFFFF", zIndex: 1 }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: "#818CF8", textTransform: "uppercase", letterSpacing: ".05em" }}>ENTERPRISE LEARNING</div>
                <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>Empower your workforce with AI-driven skill maps</div>
                <div style={{ fontSize: 12.5, opacity: 0.85, marginTop: 4 }}>Real-time team readiness tracking across 18+ industries</div>
              </div>
            </div>

          </div>
        </div>

        {/* 4 Bento Features Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 18, marginTop: 40, textAlign: "left" }}>
          <div className="lp-card" style={styles.bentoCard}>
            <div style={{ ...styles.cardIcon, background: "rgba(79,70,229,.1)" }}><BarChart3 size={20} color="#4F46E5" /></div>
            <h3 style={styles.cardTitle}>Executive Dashboard</h3>
            <p style={styles.cardDesc}>Org-wide readiness scores and skill gaps, department by department, built for decision-makers.</p>
          </div>
          <div className="lp-card" style={styles.bentoCard}>
            <div style={{ ...styles.cardIcon, background: "rgba(99,102,241,.1)" }}><Brain size={20} color="#6366F1" /></div>
            <h3 style={styles.cardTitle}>AI Coach in Action</h3>
            <p style={styles.cardDesc}>Every learner gets a 24/7 AI coach, personalised to their role and the gaps that matter.</p>
          </div>
          <div className="lp-card" style={styles.bentoCard}>
            <div style={{ ...styles.cardIcon, background: "rgba(23,166,115,.1)" }}><Compass size={20} color="#17A673" /></div>
            <h3 style={styles.cardTitle}>Live Skill Graph</h3>
            <p style={styles.cardDesc}>A live map of every skill in your organization: who has it, who's building it, where the gaps are.</p>
          </div>
          <div className="lp-card" style={styles.bentoCard}>
            <div style={{ ...styles.cardIcon, background: "rgba(245,165,36,.1)" }}><ShieldCheck size={20} color="#F5A524" /></div>
            <h3 style={styles.cardTitle}>Enterprise Compliance</h3>
            <p style={styles.cardDesc}>Append-only audit logging, DSAR data export, and multi-tenant organisation isolation.</p>
          </div>
        </div>

      </main>

      {/* The Problem Section */}
      <section className="lp-section" style={{ ...styles.section, background: "#FFFFFF" }}>
        <div style={styles.sectionInner}>
          <div style={styles.sectionTag}><AlertTriangle size={13} color="#4F46E5" /> The problem</div>
          <h2 className="lp-section-h2" style={styles.sectionH2}>Your teams are training. You still can't see what's working.</h2>
          <p style={styles.sectionSub}>
            Learning is happening somewhere in your organization. It just isn't happening anywhere leadership
            can see it. Courses get assigned, seats get filled, certificates get issued, and none of it
            tells you who's actually ready to deliver.
          </p>

          <div style={styles.statBanner}>
            Most online training loses <strong>80–85%</strong> of learners before they finish, a
            completion problem that starts on day one and shows up months later as a delivery problem.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20, textAlign: "left" }}>
            {PROBLEM_POINTS.map((p) => {
              const Icon = p.icon;
              return (
                <div key={p.title} className="lp-card" style={styles.card}>
                  <div style={{ ...styles.cardIcon, background: "rgba(239,68,68,.1)" }}><Icon size={20} color="#EF4444" /></div>
                  <h3 style={styles.cardTitle}>{p.title}</h3>
                  <p style={styles.cardDesc}>{p.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* The Platform Section: 5 Layers */}
      <section id="platform" className="lp-section" style={styles.section}>
        <div style={styles.sectionInner}>
          <div style={styles.sectionTag}><Layers size={13} color="#4F46E5" /> The platform</div>
          <h2 className="lp-section-h2" style={styles.sectionH2}>One Platform. Five Intelligence Layers.</h2>
          <p style={styles.sectionSub}>
            Train AI replaces scattered courses, spreadsheets, and status meetings with a single system that
            learns how your workforce grows.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 18, textAlign: "left" }}>
            {INTELLIGENCE_LAYERS.map((l) => {
              const Icon = l.icon;
              return (
                <div key={l.letter} className="lp-card" style={styles.card}>
                  <div style={{ ...styles.cardIcon, background: "rgba(79,70,229,.1)" }}><Icon size={20} color="#4F46E5" /></div>
                  <h3 style={styles.cardTitle}>{l.letter}</h3>
                  <p style={styles.cardDesc}>{l.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works (4 Steps) */}
      <section id="how-it-works" className="lp-section" style={{ ...styles.section, background: "#FFFFFF" }}>
        <div style={styles.sectionInner}>
          <div style={styles.sectionTag}><ClipboardList size={13} color="#4F46E5" /> How it works</div>
          <h2 className="lp-section-h2" style={styles.sectionH2}>From onboarding to outcome, in four steps.</h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20, textAlign: "left", marginTop: 24 }}>
            {HOW_IT_WORKS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="lp-card" style={{ ...styles.card, position: "relative" }}>
                  <div style={styles.stepNumber}>0{i + 1}</div>
                  <div style={styles.stepIcon}><Icon size={20} color="#4F46E5" /></div>
                  <h3 style={styles.cardTitle}>{step.title}</h3>
                  <p style={styles.cardDesc}>{step.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Solutions by Sector */}
      <section id="solutions" className="lp-section" style={styles.section}>
        <div style={styles.sectionInner}>
          <div style={styles.sectionTag}><Target size={13} color="#4F46E5" /> Solutions</div>
          <h2 className="lp-section-h2" style={styles.sectionH2}>Built around your organization's specific need.</h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, textAlign: "left", marginTop: 24 }}>
            {SOLUTIONS.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.title} className="lp-card" style={styles.card}>
                  <div style={{ ...styles.cardIcon, background: "rgba(79,70,229,.1)" }}><Icon size={20} color="#4F46E5" /></div>
                  <h3 style={styles.cardTitle}>{s.title}</h3>
                  <p style={styles.cardDesc}>{s.desc}</p>
                  <div style={styles.inlineLink} onClick={() => handleNav("book-demo")}>
                    Book a demo <ArrowRight size={13} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Traditional LMS vs Train AI Comparison Matrix */}
      <section id="why-train-ai" className="lp-section" style={{ ...styles.section, background: "#FFFFFF" }}>
        <div style={styles.sectionInner}>
          <div style={styles.sectionTag}><HelpCircle size={13} color="#4F46E5" /> Why Train AI</div>
          <h2 className="lp-section-h2" style={styles.sectionH2}>Not Another LMS. Built to Answer the Questions Yours Can't.</h2>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", marginTop: 20 }}>
            {WHY_QUESTIONS.map((q) => (
              <div key={q} className="lp-question-pill" style={styles.questionPill}>{q}</div>
            ))}
          </div>

          <h3 style={{ ...styles.sectionH2, fontSize: 22, marginTop: 48, marginBottom: 20 }}>Traditional LMS vs. Train AI</h3>
          <div style={{ overflowX: "auto", marginTop: 8 }}>
            <table style={styles.comparisonTable}>
              <thead>
                <tr>
                  <th style={styles.comparisonHeaderCell}>Dimension</th>
                  <th style={styles.comparisonHeaderCell}>Traditional LMS</th>
                  <th style={{ ...styles.comparisonHeaderCell, color: "#4F46E5", background: "#EEF2FF" }}>Train AI Platform</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.dimension}>
                    <td style={styles.comparisonCellLabel}>{row.dimension}</td>
                    <td style={styles.comparisonCell}>{row.lms}</td>
                    <td style={{ ...styles.comparisonCell, fontWeight: 800, color: "#4F46E5", background: "#FAF5FF" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <Check size={14} color="#10B981" /> {row.trainai}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="lp-section" style={styles.section}>
        <div style={styles.sectionInner}>
          <div style={styles.sectionTag}><ShieldCheck size={13} color="#4F46E5" /> Pricing</div>
          <h2 className="lp-section-h2" style={styles.sectionH2}>Simple Tiers That Grow With Your Team.</h2>
          <p style={styles.sectionSub}>Transparent pricing framed around workforce value, not just seat counts.</p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24, textAlign: "left", marginTop: 24 }}>
            {PRICING_TIERS.map((tier) => (
              <div
                key={tier.name}
                className="lp-card"
                style={{
                  ...styles.pricingCard,
                  border: tier.highlighted ? "2px solid #4F46E5" : "1px solid #E2E8F0",
                  boxShadow: tier.highlighted ? "0 20px 40px -16px rgba(79,70,229,.25)" : "0 4px 16px rgba(15,23,42,0.03)"
                }}
              >
                {tier.highlighted && <div style={styles.pricingBadge}>Most popular</div>}
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

      {/* FAQ Accordion */}
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

      {/* Book a Demo & Inquiry Terminal */}
      <section id="book-demo" className="lp-section" style={styles.ctaSection}>
        <div style={{ ...styles.sectionInner, maxWidth: 640 }}>
          <h2 className="lp-section-h2" style={{ ...styles.sectionH2, color: "#FFFFFF" }}>
            {contactMode === "demo" ? "Stop Measuring Learning. Start Measuring Workforce Readiness." : "Organisation Inquiry"}
          </h2>
          <p style={{ ...styles.sectionSub, color: "rgba(255,255,255,0.85)", marginBottom: 28 }}>
            {contactMode === "demo"
              ? "Book a demo and see your organization's skills, gaps, and readiness mapped in real time."
              : "Tell us about your team's goals, custom requirements, or procurement timelines."}
          </p>

          <div style={styles.contactModeToggle}>
            <button
              type="button"
              style={contactMode === "demo" ? styles.contactModeBtnActive : styles.contactModeBtn}
              onClick={() => setContactMode("demo")}
            >
              Book a Live Demo
            </button>
            <button
              type="button"
              style={contactMode === "inquiry" ? styles.contactModeBtnActive : styles.contactModeBtn}
              onClick={() => setContactMode("inquiry")}
            >
              Organisation Inquiry
            </button>
          </div>

          <div style={styles.waitlistCard}>
            {contactMode === "demo" ? (
              demoSubmitted ? (
                <div style={styles.successBox}>
                  <CheckCircle2 size={22} color="#10B981" />
                  <span>Thank you! We will reach out to schedule your personalized live demo shortly.</span>
                </div>
              ) : (
                <form onSubmit={handleDemoSubmit} className="lp-demo-form" style={styles.demoForm}>
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
                        required placeholder="Company name" value={demoCompany}
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
              )
            ) : (
              inquirySubmitted ? (
                <div style={styles.successBox}>
                  <CheckCircle2 size={22} color="#10B981" />
                  <span>Thank you! Our enterprise partnership team will respond within 24 hours.</span>
                </div>
              ) : (
                <form onSubmit={handleInquirySubmit} className="lp-demo-form" style={styles.demoForm}>
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
                        required placeholder="Company name" value={demoCompany}
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
                        value={inquiryType} onChange={(e) => setInquiryType(e.target.value)}
                        style={{ ...styles.demoInput, paddingLeft: 14 }}
                      >
                        {INQUIRY_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <textarea
                    placeholder="Provide details on your inquiry or specific procurement needs"
                    value={demoMessage} onChange={(e) => setDemoMessage(e.target.value)}
                    rows={2} style={styles.demoTextarea}
                  />
                  <button type="submit" disabled={submitting} className="action-btn" style={styles.submitBtn}>
                    {submitting ? "Sending..." : "Send Enterprise Inquiry"} <ArrowRight size={16} />
                  </button>
                  {inquiryError && <div style={styles.errorText}>{inquiryError}</div>}
                </form>
              )
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
            <span className="lp-footer-link" onClick={() => handleNav("solutions")}>Solutions &amp; Tracks</span>
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
  bentoCard: { background: "#FFFFFF", padding: 20, borderRadius: 18, border: "1px solid #E2E8F0" },
  cardIcon: { width: 40, height: 40, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  cardTitle: { fontSize: 15.5, fontWeight: 800, margin: "0 0 6px", color: "#0F172A" },
  cardDesc: { fontSize: 13, color: "#64748B", margin: 0, lineHeight: 1.45 },
  inlineLink: { fontSize: 12.5, fontWeight: 800, color: "#4F46E5", marginTop: 12, display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" },
  stepNumber: { position: "absolute", top: 16, right: 18, fontSize: 14, fontWeight: 900, color: "#A5B4FC" },
  stepIcon: { width: 40, height: 40, borderRadius: 12, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  questionPill: { background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 99, padding: "8px 16px", fontSize: 12.5, fontWeight: 700, color: "#0F172A" },
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
  contactModeToggle: { display: "inline-flex", background: "rgba(255,255,255,.14)", borderRadius: 12, padding: 4, gap: 4, marginBottom: 20 },
  contactModeBtn: { border: "none", background: "transparent", color: "rgba(255,255,255,.8)", padding: "8px 16px", borderRadius: 9, fontWeight: 700, fontSize: 12.5, cursor: "pointer" },
  contactModeBtnActive: { border: "none", background: "#FFFFFF", color: "#0F172A", padding: "8px 16px", borderRadius: 9, fontWeight: 800, fontSize: 12.5, cursor: "pointer" },
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
