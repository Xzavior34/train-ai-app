import React, { useState, useEffect } from "react";
import {
  ArrowRight, BookOpen, GraduationCap, Cpu, ShieldCheck, CheckCircle2, Globe, X,
  Brain, Layers, ChevronDown, HelpCircle, ClipboardList, UserPlus, Rocket,
  Building2, Users, Target, TrendingUp, AlertTriangle, Eye, Lock, Compass, BarChart3,
  GitCompare, Table, School, Handshake, Briefcase, Zap, Sparkles, Flame
} from "lucide-react";
import { submitDemoRequest, submitOrganizationInquiry, captureAttributionFromURL } from "../../lib/api/waitlist.js";
import { trackReferralClickIfPresent, TIER_PRICING } from "../../lib/api/organizations.js";

// ============================================================================
// Copy source: "TRAIN AI - Website Copy & Structure - Master Draft" (New
// Version), which explicitly supersedes the prior draft ("merges two prior
// versions into one definitive structure"). Every heading, body line, stat,
// and FAQ answer below is copied from that document as written - this is a
// positioning/marketing document, not a feature-by-feature engineering
// spec, so it's followed strictly rather than filtered through "is this
// literally shipped" the way the rest of this app's copy has been.
//
// Structural note: the master draft lays out a full multi-page site (Home,
// Platform, Solutions, Why Train AI, Built for Organizations, For
// Individuals, Enterprise Readiness, Pricing, FAQ). This app has no router
// it's a single scrolling page with anchor-linked sections, the same
// pattern the existing nav already used for "Platform"/"Pricing" before
// this rewrite. Rather than build real client-side routing (a much larger,
// separate change), each "page" in the draft is implemented as its own
// full section on this one page, in the same order as the sitemap, with
// the nav linking to each by anchor. Flagging this rather than quietly
// picking one interpretation.
// ============================================================================

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

// Pricing. These tier names match what checkout actually charges against
// (TIER_PRICING in lib/api/organizations.js, used by
// startOrganizationSubscriptionPayment), but this table previously showed no
// figure at all - just "Per user" - so a visitor learned the real amount only
// after starting a payment. The amounts are now read from that same exported
// constant rather than retyped here, so the page and the charge cannot drift
// apart. Enterprise stays "Custom" because it genuinely is:
// startOrganizationSubscriptionPayment refuses the enterprise tier and routes
// to Book a Demo instead.
//
// Per-tier entitlements are resolved server-side by tier_default_feature()
// (0115_organization_feature_flags.sql) and can be overridden per
// organization by the Platform Owner, so these bullet lists cannot be a
// guarantee of what a tier contains. They are kept as indicative highlights
// and labelled as such.
const PRICING_TIERS = [
  {
    name: "Starter",
    tierKey: "starter",
    tagline: "For teams just getting started with structured learning. Core platform, per-user pricing, no long-term commitment.",
    priceNote: "Per user, per month. No long-term commitment.",
    features: [
      "Full learner experience: AI Coach, AI Insights, Quiz Generator",
      "Cohorts, courses, assessments, certificates",
      "Organisation dashboard for a single team",
    ],
    highlighted: false,
  },
  {
    name: "Growth",
    tierKey: "growth",
    tagline: "For organizations scaling cohorts across departments, with volume pricing as you onboard more of your team.",
    priceNote: "Per user, per month. Volume pricing as headcount grows.",
    features: [
      "Everything in Starter",
      "Multi-department Workforce Intelligence Dashboard",
      "Manager views at scale, compliance tracking",
      "Org-level course management, analytics export",
    ],
    highlighted: true,
  },
  {
    name: "Enterprise",
    tierKey: "enterprise",
    tagline: "For organizations that need full customization, dedicated support, and infrastructure built around them. Custom enterprise pricing.",
    priceNote: "Annual contract. Talk to us for a quote.",
    features: [
      "Everything in Growth",
      "SSO and API integrations",
      "Custom branding, data residency options",
      "Dedicated support, custom SLAs",
    ],
    highlighted: false,
  },
];

// The real charged amount for a tier, or "Custom" where none exists
// (enterprise, which is deliberately absent from TIER_PRICING).
function tierPriceLabel(tierKey) {
  const pricing = TIER_PRICING[tierKey];
  if (!pricing) return "Custom";
  return `₦${pricing.amountNGN.toLocaleString()}`;
}

function tierPriceAltLabel(tierKey) {
  const pricing = TIER_PRICING[tierKey];
  return pricing ? `≈ $${pricing.amountUSD}` : null;
}

const INQUIRY_TYPE_OPTIONS = [
  { value: "procurement", label: "Procurement / security review" },
  { value: "partnership", label: "Partnership" },
  { value: "custom_requirements", label: "Custom requirements" },
  { value: "other", label: "Something else" },
];

const FAQ_ITEMS = [
  {
    q: "How is this different from TalentLMS and other learning management systems?",
    a: "Those platforms give you a library of courses. Train AI gives you a living map of your workforce's skills: who has them, who's building them, and where the gaps are. We're built around outcomes and visibility, not just content delivery."
  },
  {
    q: "Can our team use this without a full enterprise rollout?",
    a: "Yes. Most organizations start with a single team or cohort as a pilot, then expand once they've seen the readiness data for themselves."
  },
  {
    q: "How does pricing scale with team size?",
    a: "Pricing is per user, with better rates as your team grows. Larger organizations move to a custom enterprise plan built around their specific needs, so there are no surprise jumps."
  },
  {
    q: "What does onboarding look like?",
    a: "You bring your team in, we help you map roles to skills, and Train AI builds a readiness baseline within days, not months. A dedicated team supports you through setup."
  },
  {
    q: "Who owns our data?",
    a: "You do, full stop. Your organization's learning and skills data stays yours. We don't sell it or share it outside your account."
  }
];

export default function LandingPage({ onNavigate }) {
  // Campaign attribution (PRD Platform Owner Analytics) - captured once on
  // mount, before any UTM query params could be lost to navigation within
  // this single-page app.
  useEffect(() => { captureAttributionFromURL(); }, []);

  // Referral link clicks (the "Invite & Earn" panel in ProfileScreen) -
  // same "capture once on mount before it's lost" reasoning as the UTM
  // capture above, kept as a separate call since it's a distinct feature
  // with its own storage key.
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
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleNav(target) {
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

        .lp-nav-link { transition: color .15s ease; }
        .lp-nav-link:hover { color: #4F46E5 !important; }
        .lp-footer-link { transition: color .15s ease; }
        .lp-footer-link:hover { color: #4F46E5 !important; }
        .lp-contact-toggle-btn { transition: all .15s ease; }
        .lp-outline-btn { transition: background .15s ease, transform .15s ease; }
        .lp-outline-btn:hover { background: #F8FAFC; }
        .lp-outline-btn:active { transform: scale(.97); }
        .lp-faq-chevron { transition: transform .2s ease; }
        .lp-faq-answer { animation: heroPop .22s ease both; }
        .lp-question-pill { transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease; }
        .lp-question-pill:hover { transform: translateY(-2px); box-shadow: 0 6px 16px -6px rgba(15,23,42,.1); border-color: #C7D2FE; }
        .lp-demo-form input, .lp-demo-form select, .lp-demo-form textarea { transition: border-color .15s ease, box-shadow .15s ease; }
        .lp-demo-form input:focus, .lp-demo-form select:focus, .lp-demo-form textarea:focus { border-color: #4F46E5 !important; box-shadow: 0 0 0 3px rgba(79,70,229,.12); }

        .lp-stagger > * { opacity: 0; animation: heroPop .4s ease both; }
        .lp-stagger > *:nth-child(1) { animation-delay: .03s; }
        .lp-stagger > *:nth-child(2) { animation-delay: .08s; }
        .lp-stagger > *:nth-child(3) { animation-delay: .13s; }
        .lp-stagger > *:nth-child(4) { animation-delay: .18s; }
        .lp-stagger > *:nth-child(5) { animation-delay: .23s; }
        .lp-stagger > *:nth-child(n+6) { animation-delay: .28s; }

        @media (max-width: 760px) {
          .lp-nav-links { display: none; }
          .lp-header-inner { padding: 10px 14px; }
          .lp-header-actions { gap: 6px; }
          .lp-header-actions button { padding: 8px 11px; font-size: 12px; }
          .lp-brand-sub { display: none; }
          .lp-comparison-table { font-size: 11.5px !important; }
          .lp-legal-links { flex-wrap: wrap; row-gap: 6px; }
          .lp-contact-toggle { flex-wrap: wrap; justify-content: center; }
        }
        @media (max-width: 560px) {
          .lp-hero-section { padding: 36px 16px 48px !important; }
          .lp-hero-h1 { font-size: 28px !important; }
          .lp-hero-sub { font-size: 14.5px !important; }
          .lp-section { padding: 44px 16px !important; }
          .lp-section-h2 { font-size: 22px !important; }
          .lp-demo-form-row { flex-direction: column; }
          .lp-footer-inner { flex-direction: column; gap: 20px; align-items: flex-start !important; text-align: left; }
          .lp-pricing-card { max-width: 100% !important; }
        }
        @media (max-width: 480px) {
          .lp-hero-cta-row { flex-direction: column; }
        }
        @media (max-width: 400px) {
          .lp-header-brand img { height: 36px !important; }
          .lp-header-actions { gap: 4px; }
          .lp-header-actions button { padding: 7px 9px; font-size: 11px; }
          .lp-contact-toggle-btn { padding: 7px 12px !important; font-size: 11.5px !important; }
          .lp-mockup-url { display: none; }
          .lp-mockup-grid { padding: 14px !important; gap: 14px !important; }
        }
      `}</style>

      <header style={styles.header}>
        <div className="lp-header-inner" style={styles.headerInner}>
          <div className="lp-header-brand" style={{ ...styles.brandRow, cursor: "pointer" }} onClick={() => handleNav("home")}>
            <img src="/train-ai-logo.png" alt="Train AI" style={{ height: 48, width: "auto", objectFit: "contain", display: "block" }} />
          </div>

          <nav className="lp-nav-links" style={styles.navLinks}>
            <span className="lp-nav-link" style={styles.navLink} onClick={() => handleNav("platform")}>Platform</span>
            <span className="lp-nav-link" style={styles.navLink} onClick={() => handleNav("solutions")}>Solutions</span>
            <span className="lp-nav-link" style={styles.navLink} onClick={() => handleNav("why-train-ai")}>Why Train AI</span>
            <span className="lp-nav-link" style={styles.navLink} onClick={() => handleNav("pricing")}>Pricing</span>
            <span className="lp-nav-link" style={styles.navLinkQuiet} onClick={() => handleNav("individuals")}>For Individuals</span>
          </nav>

          <div className="lp-header-actions" style={{ display: "flex", gap: 10, flexShrink: 0 }}>
            <button className="lp-outline-btn" style={styles.signInBtn} onClick={() => handleNav("signin")}>Sign In</button>
            <button className="action-btn" style={styles.getStartedBtn} onClick={() => handleNav("book-demo")}>Book a Demo</button>
          </div>
        </div>
      </header>

      <main className="hero-anim lp-hero-section" style={styles.heroSection}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 99,
          background: "linear-gradient(135deg, #EEF2FF 0%, #F5F3FF 100%)", border: "1px solid #E0E7FF",
          color: "#4F46E5", fontSize: 12.5, fontWeight: 800, marginBottom: 20
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4F46E5", display: "inline-block" }} /> AI WORKFORCE INTELLIGENCE PLATFORM
        </div>

        <h1 className="lp-hero-h1" style={{ ...styles.heroH1, fontSize: 46, maxWidth: 840, margin: "0 auto 18px" }}>
          Measure readiness,<br /><span style={{ background: "linear-gradient(135deg, #4338CA 0%, #4F46E5 50%, #6366F1 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>not completion.</span>
        </h1>
        <p className="lp-hero-sub" style={{ ...styles.heroSub, fontSize: 17, maxWidth: 760, margin: "0 auto 30px" }}>
          Train AI turns learning activity into decision-ready intelligence about workforce readiness, skill coverage and team capability — so you know who is ready, who is stuck, and where the gaps are.
        </p>

        <div className="lp-hero-cta-row" style={styles.heroCtaRow}>
          <button className="action-btn" style={styles.getStartedBtn} onClick={() => handleNav("book-demo")}>
            Start with your organisation<ArrowRight size={16} />
          </button>
          <button className="lp-outline-btn" style={styles.heroSecondaryBtn} onClick={() => handleNav("book-demo")}>Request a demo</button>
        </div>

        {/* 3 Pill Metric Cards under CTAs matching Screenshot 3 */}
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

        {/* Hero Interactive UI Preview Mockup matching Screenshot 3 */}
        <div style={{
          marginTop: 48, position: "relative", borderRadius: 24, overflow: "hidden",
          border: "1px solid #E2E8F0", background: "#FFFFFF",
          boxShadow: "0 24px 60px -12px rgba(79, 70, 229, 0.18), 0 8px 24px -4px rgba(15, 23, 42, 0.06)",
          textAlign: "left"
        }}>
          {/* Mockup Top Header */}
          <div className="lp-mockup-header" style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, rowGap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#EF4444", flexShrink: 0 }} />
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#F59E0B", flexShrink: 0 }} />
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#10B981", flexShrink: 0 }} />
              <span className="lp-mockup-url" style={{ fontSize: 12, fontWeight: 700, color: "#64748B", marginLeft: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>app.trainailtd.com/workforce-intelligence</span>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
              {/* Was "⚡ Live Intelligence Signal". This is a static product
                  screenshot on an unauthenticated marketing page - no query
                  could legitimately fill it - so the "Live" framing is gone
                  and the mockup is labelled as an example. */}
              <span style={{ fontSize: 11.5, fontWeight: 700, color: "#4F46E5", background: "#EEF2FF", padding: "3px 10px", borderRadius: 8, whiteSpace: "nowrap" }}>Example dashboard</span>
            </div>
          </div>

          {/* Mockup Dashboard Content Grid */}
          <div className="lp-mockup-grid" style={{ padding: 24, background: "#F8FAFC", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))", gap: 20 }}>
            {/* Workforce Intelligence Readiness by Team Card matching Screenshot 3 */}
            <div style={{
              background: "#FFFFFF", borderRadius: 18, border: "1px solid #E2E8F0", padding: 22,
              boxShadow: "0 4px 16px rgba(15, 23, 42, 0.04)"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase" }}>WORKFORCE INTELLIGENCE</div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: "#0F172A", marginTop: 2 }}>Readiness by team</div>
                </div>
                {/* "Live" over illustrative readiness figures (71, +4 this
                    month, per-team scores) - the numbers are sample content,
                    so the badge now says so. */}
                <span style={{ fontSize: 11, fontWeight: 800, color: "#4F46E5", background: "#EEF2FF", padding: "2px 8px", borderRadius: 6 }}>Sample</span>
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
                    <span style={{ color: "#334155" }}>Sales</span>
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

            {/* Right Side Team Stock Image Card */}
            <div style={{
              borderRadius: 18, overflow: "hidden", position: "relative",
              border: "1px solid #E2E8F0", minHeight: 280,
              backgroundImage: "url('https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&fit=crop&q=80')",
              backgroundSize: "cover", backgroundPosition: "center",
              display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 20
            }}>
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(15,23,42,0.85) 0%, rgba(15,23,42,0.2) 60%, transparent 100%)" }} />
              <div style={{ position: "relative", color: "#FFFFFF", zIndex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#818CF8", textTransform: "uppercase", letterSpacing: ".05em" }}>ENTERPRISE LEARNING</div>
                <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>Empower your workforce with AI-driven skill maps</div>
                {/* "across 18+ industries" was a factual customer-base claim
                    with nothing behind it - dropped rather than softened. */}
                <div style={{ fontSize: 12.5, opacity: 0.85, marginTop: 4 }}>Team readiness tracking built for any industry</div>
              </div>
            </div>
          </div>
        </div>

        <div style={styles.heroNote}>
          Learning on your own? <span style={{ color: "#4F46E5", fontWeight: 700, cursor: "pointer" }} onClick={() => handleNav("individuals")}>Get your own AI coach and dashboard here →</span>
        </div>

        <div style={styles.grid}>
          <div className="lp-card" style={styles.card}>
            <div style={{ ...styles.cardIcon, background: "rgba(79,70,229,.1)" }}><BarChart3 size={20} color="#4F46E5" /></div>
            <h3 style={styles.cardTitle}>Executive Dashboard</h3>
            <p style={styles.cardDesc}>Org-wide readiness scores and skill gaps, department by department, built for decision-makers.</p>
          </div>
          <div className="lp-card" style={styles.card}>
            <div style={{ ...styles.cardIcon, background: "rgba(99,102,241,.1)" }}><Brain size={20} color="#6366F1" /></div>
            <h3 style={styles.cardTitle}>AI Coach in Action</h3>
            <p style={styles.cardDesc}>Every learner gets a 24/7 AI coach, personalised to their role and the gaps that matter.</p>
          </div>
          <div className="lp-card" style={styles.card}>
            <div style={{ ...styles.cardIcon, background: "rgba(23,166,115,.1)" }}><Compass size={20} color="#17A673" /></div>
            <h3 style={styles.cardTitle}>Live Skill Graph</h3>
            <p style={styles.cardDesc}>A live map of every skill in your organization: who has it, who's building it, where the gaps are.</p>
          </div>
          <div className="lp-card" style={styles.card}>
            <div style={{ ...styles.cardIcon, background: "rgba(245,165,36,.1)" }}><ShieldCheck size={20} color="#F5A524" /></div>
            <h3 style={styles.cardTitle}>Enterprise Compliance</h3>
            <p style={styles.cardDesc}>Append-only audit logging, DSAR data export, and multi-tenant organisation isolation.</p>
          </div>
        </div>
      </main>

      <section className="lp-section" style={{ ...styles.section, background: "#fff" }}>
        <div style={{ ...styles.sectionInner, maxWidth: 780 }}>
          <div style={styles.sectionTag}><Globe size={13} color="#4F46E5" /> Who we are</div>
          <p style={styles.bodyLarge}>
            Train AI is the AI learning infrastructure for organizations that never stop learning. We combine
            AI-personalised learning paths, live skills data, and real human mentorship into one platform, so
            leadership always knows who's ready, who's stuck, and where the next skill gap is, before it turns
            into a missed delivery.
          </p>
          <p style={styles.bodyLarge}>
            We're not another course library. We're the layer that sits underneath your L&amp;D, turning
            training from something people complete into something the business can actually see, measure,
            and act on.
          </p>
        </div>
      </section>

      <section className="lp-section" style={styles.section}>
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

          <div className="lp-stagger" style={styles.featuresGrid}>
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

      <section id="platform" className="lp-section" style={{ ...styles.section, background: "#fff" }}>
        <div style={styles.sectionInner}>
          <div style={styles.sectionTag}><Layers size={13} color="#4F46E5" /> The platform</div>
          <h2 className="lp-section-h2" style={styles.sectionH2}>One Platform. Five Intelligence Layers.</h2>
          <p style={styles.sectionSub}>
            Train AI replaces scattered courses, spreadsheets, and status meetings with a single system that
            learns how your workforce grows.
          </p>

          <div className="lp-stagger" style={styles.featuresGrid}>
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

      <section id="how-it-works" className="lp-section" style={styles.section}>
        <div style={styles.sectionInner}>
          <div style={styles.sectionTag}><ClipboardList size={13} color="#4F46E5" /> How it works</div>
          <h2 className="lp-section-h2" style={styles.sectionH2}>From onboarding to outcome, in four steps.</h2>

          <div className="lp-stagger" style={styles.stepsRow}>
            {HOW_IT_WORKS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="lp-card" style={styles.stepCard}>
                  <div style={styles.stepNumber}>{i + 1}</div>
                  <div style={styles.stepIcon}><Icon size={20} color="#4F46E5" /></div>
                  <h3 style={styles.cardTitle}>{step.title}</h3>
                  <p style={styles.cardDesc}>{step.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="solutions" className="lp-section" style={{ ...styles.section, background: "#fff" }}>
        <div style={styles.sectionInner}>
          <div style={styles.sectionTag}><Target size={13} color="#4F46E5" /> Solutions</div>
          <h2 className="lp-section-h2" style={styles.sectionH2}>Built around your organization's specific need.</h2>

          <div className="lp-stagger" style={styles.featuresGrid}>
            {SOLUTIONS.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.title} className="lp-card" style={styles.card}>
                  <div style={{ ...styles.cardIcon, background: "rgba(79,70,229,.1)" }}><Icon size={20} color="#4F46E5" /></div>
                  <h3 style={styles.cardTitle}>{s.title}</h3>
                  <p style={styles.cardDesc}>{s.desc}</p>
                  <div style={styles.inlineLink} onClick={() => handleNav("book-demo")}>Book a demo <ArrowRight size={13} /></div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="why-train-ai" className="lp-section" style={styles.section}>
        <div style={styles.sectionInner}>
          <div style={styles.sectionTag}><HelpCircle size={13} color="#4F46E5" /> Why Train AI</div>
          <h2 className="lp-section-h2" style={styles.sectionH2}>Not Another LMS. Built to Answer the Questions Yours Can't.</h2>
          <p style={styles.sectionSub}>Train AI is built to answer questions a standard learning platform cannot:</p>

          <div className="lp-stagger" style={styles.questionGrid}>
            {WHY_QUESTIONS.map((q) => (
              <div key={q} className="lp-question-pill" style={styles.questionPill}>{q}</div>
            ))}
          </div>

          <h3 style={{ ...styles.sectionH2, fontSize: 20, marginTop: 48, marginBottom: 24 }}>The features that answer them</h3>
          <div className="lp-stagger" style={styles.featuresGrid}>
            {WHY_FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="lp-card" style={styles.card}>
                  <div style={{ ...styles.cardIcon, background: "rgba(79,70,229,.1)" }}><Icon size={20} color="#4F46E5" /></div>
                  <h3 style={styles.cardTitle}>{f.title}</h3>
                  <p style={styles.cardDesc}>{f.desc}</p>
                  {f.answers && <p style={styles.answersLine}>Answers: {f.answers}</p>}
                </div>
              );
            })}
          </div>

          <h3 style={{ ...styles.sectionH2, fontSize: 20, marginTop: 48, marginBottom: 24 }}>Traditional LMS vs. Train AI</h3>
          <div className="lp-comparison-table" style={styles.comparisonWrap}>
            <table style={styles.comparisonTable}>
              <thead>
                <tr>
                  <th style={styles.comparisonHeaderCell}>Dimension</th>
                  <th style={styles.comparisonHeaderCell}>Traditional LMS</th>
                  <th style={{ ...styles.comparisonHeaderCell, color: "#4F46E5" }}>Train AI</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.dimension}>
                    <td style={styles.comparisonCellLabel}>{row.dimension}</td>
                    <td style={styles.comparisonCell}>{row.lms}</td>
                    <td style={{ ...styles.comparisonCell, fontWeight: 700, color: "#0F172A" }}>{row.trainai}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section id="organizations" className="lp-section" style={{ ...styles.section, background: "#fff" }}>
        <div style={styles.sectionInner}>
          <div style={styles.sectionTag}><Building2 size={13} color="#4F46E5" /> Built for organizations</div>
          <h2 className="lp-section-h2" style={styles.sectionH2}>Everything Your L&amp;D and HR Team Needs, in One Platform.</h2>

          <div className="lp-stagger" style={styles.featuresGrid}>
            {ORG_FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="lp-card" style={styles.card}>
                  <div style={{ ...styles.cardIcon, background: "rgba(79,70,229,.1)" }}><Icon size={20} color="#4F46E5" /></div>
                  <h3 style={styles.cardTitle}>{f.title}</h3>
                  <p style={styles.cardDesc}>{f.desc}</p>
                </div>
              );
            })}
          </div>

          <p style={{ ...styles.sectionSub, marginTop: 40, marginBottom: 8 }}>
            Every organization account also gives learners their own AI coach, personalised courses, and
            access to a learning community, included, not sold separately.
          </p>
          <p style={{ fontSize: 12.5, color: "#9AA1B9" }}>
            Don't have an organization behind you? You can still get your own dashboard and AI coach.{" "}
            <span style={{ color: "#4F46E5", fontWeight: 700, cursor: "pointer" }} onClick={() => handleNav("individuals")}>Visit For Individuals to get started.</span>
          </p>
        </div>
      </section>

      <section id="individuals" className="lp-section" style={styles.section}>
        <div style={{ ...styles.sectionInner, maxWidth: 720 }}>
          <div style={styles.sectionTag}><Users size={13} color="#4F46E5" /> For individuals</div>
          <h2 className="lp-section-h2" style={styles.sectionH2}>Your Own AI-Powered Path to a Tech Career.</h2>
          <p style={styles.sectionSub}>
            No organization behind you? You don't need one. Get a personalised learning path, an AI coach,
            and a community of peers, all in one place.
          </p>

          <div className="lp-stagger" style={styles.featuresGrid}>
            {INDIVIDUAL_FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="lp-card" style={styles.card}>
                  <div style={{ ...styles.cardIcon, background: "rgba(79,70,229,.1)" }}><Icon size={20} color="#4F46E5" /></div>
                  <h3 style={styles.cardTitle}>{f.title}</h3>
                  <p style={styles.cardDesc}>{f.desc}</p>
                </div>
              );
            })}
          </div>

          <button className="action-btn" style={{ ...styles.getStartedBtn, marginTop: 32 }} onClick={() => handleNav("signup")}>
            Create your free account<ArrowRight size={16} />
          </button>
        </div>
      </section>

      <section className="lp-section" style={{ ...styles.section, background: "#fff" }}>
        <div style={styles.sectionInner}>
          <div style={styles.sectionTag}><Lock size={13} color="#4F46E5" /> Enterprise readiness</div>
          <h2 className="lp-section-h2" style={styles.sectionH2}>Built for Procurement, Not Just for Pilots.</h2>

          <div className="lp-stagger" style={styles.featuresGrid}>
            <div className="lp-card" style={styles.card}>
              <div style={{ ...styles.cardIcon, background: "rgba(79,70,229,.1)" }}><Lock size={20} color="#4F46E5" /></div>
              <h3 style={styles.cardTitle}>Data ownership</h3>
              <p style={styles.cardDesc}>Your data is yours. We don't sell it, and we don't use it to train models outside your organization's own account.</p>
            </div>
            <div className="lp-card" style={styles.card}>
              <div style={{ ...styles.cardIcon, background: "rgba(23,166,115,.1)" }}><ShieldCheck size={20} color="#17A673" /></div>
              <h3 style={styles.cardTitle}>Privacy</h3>
              <p style={styles.cardDesc}>Built with EU and Africa data protection standards in mind, so your compliance team isn't left guessing.</p>
            </div>
            <div className="lp-card" style={styles.card}>
              <div style={{ ...styles.cardIcon, background: "rgba(245,165,36,.1)" }}><Globe size={20} color="#F5A524" /></div>
              <h3 style={styles.cardTitle}>SSO &amp; integrations</h3>
              <p style={styles.cardDesc}>Enterprise SSO and API integrations to support your teams, on our roadmap. We'll tell you exactly where things stand when we talk, no surprises in a live demo.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="lp-section" style={styles.section}>
        <div style={styles.sectionInner}>
          <div style={styles.sectionTag}><ShieldCheck size={13} color="#4F46E5" /> Pricing</div>
          <h2 className="lp-section-h2" style={styles.sectionH2}>Simple Tiers That Grow With Your Team.</h2>
          <p style={styles.sectionSub}>Pricing is framed around value and scale, not just seats.</p>

          <div className="lp-stagger" style={styles.pricingGrid}>
            {PRICING_TIERS.map((tier) => (
              <div key={tier.name} className="lp-card lp-pricing-card" style={tier.highlighted ? { ...styles.pricingCard, ...styles.pricingCardHighlighted } : styles.pricingCard}>
                {tier.highlighted && <div style={styles.pricingBadge}>Most popular</div>}
                <h3 style={styles.pricingName}>{tier.name}</h3>
                <p style={styles.pricingTagline}>{tier.tagline}</p>
                <div style={styles.pricingPriceRow}>
                  <span style={styles.pricingPrice}>{tierPriceLabel(tier.tierKey)}</span>
                  {tierPriceAltLabel(tier.tierKey) && (
                    <span style={{ fontSize: 13, color: "#64748B", fontWeight: 600 }}>{tierPriceAltLabel(tier.tierKey)}</span>
                  )}
                </div>
                <p style={styles.pricingNote}>{tier.priceNote}</p>
                <div style={{ fontSize: 11, color: "#94A3B8", margin: "-12px 0 14px" }}>
                  Indicative highlights — exact entitlements are confirmed on your plan.
                </div>
                <ul style={styles.pricingFeatureList}>
                  {tier.features.map((f) => (
                    <li key={f} style={styles.pricingFeatureItem}>
                      <CheckCircle2 size={15} color="#17A673" style={{ flexShrink: 0, marginTop: 2 }} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  className={tier.highlighted ? "action-btn" : "action-btn lp-outline-btn"}
                  style={tier.highlighted ? styles.getStartedBtn : styles.pricingOutlineBtn}
                  onClick={() => handleNav("book-demo")}
                >
                  Speak with us today<ArrowRight size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section" style={{ ...styles.section, background: "#fff" }}>
        <div style={{ ...styles.sectionInner, maxWidth: 720 }}>
          <div style={styles.sectionTag}><HelpCircle size={13} color="#4F46E5" /> FAQ</div>
          <h2 className="lp-section-h2" style={styles.sectionH2}>Frequently asked questions</h2>

          <div style={styles.faqList}>
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
                      color="#656C86"
                      style={{ flexShrink: 0, transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                    />
                  </button>
                  {isOpen && <p className="lp-faq-answer" style={styles.faqAnswer}>{item.a}</p>}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="book-demo" className="lp-section" style={styles.ctaSection}>
        <div style={styles.sectionInner}>
          <h2 className="lp-section-h2" style={{ ...styles.sectionH2, color: "#fff" }}>
            {contactMode === "demo" ? "Stop Measuring Learning. Start Measuring Workforce Readiness." : "Not ready for a demo yet?"}
          </h2>
          <p style={{ ...styles.sectionSub, color: "rgba(255,255,255,.75)" }}>
            {contactMode === "demo"
              ? "Book a demo and see your organization's skills, gaps, and readiness, mapped in real time."
              : "Send us your procurement, partnership, or custom requirements question."}
          </p>

          <div className="lp-contact-toggle" style={styles.contactModeToggle}>
            <button
              type="button"
              className="lp-contact-toggle-btn"
              style={contactMode === "demo" ? styles.contactModeBtnActive : styles.contactModeBtn}
              onClick={() => setContactMode("demo")}
            >
              Book a Demo
            </button>
            <button
              type="button"
              className="lp-contact-toggle-btn"
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
                  <CheckCircle2 size={20} color="#17A673" />
                  <span>Thanks! We'll reach out to schedule your demo shortly.</span>
                </div>
              ) : (
                <form onSubmit={handleDemoSubmit} className="lp-demo-form" style={styles.demoForm}>
                  <div className="lp-demo-form-row" style={styles.demoFormRow}>
                    <div style={styles.demoInputWrap}>
                      <Users size={14} color="#9AA1B9" style={styles.demoInputIcon} />
                      <input
                        required placeholder="Full name" value={demoName}
                        onChange={(e) => setDemoName(e.target.value)}
                        style={styles.demoInput}
                      />
                    </div>
                    <div style={styles.demoInputWrap}>
                      <Building2 size={14} color="#9AA1B9" style={styles.demoInputIcon} />
                      <input
                        required placeholder="Company name" value={demoCompany}
                        onChange={(e) => setDemoCompany(e.target.value)}
                        style={styles.demoInput}
                      />
                    </div>
                  </div>
                  <div className="lp-demo-form-row" style={styles.demoFormRow}>
                    <div style={{ ...styles.demoInputWrap, flex: 2 }}>
                      <Globe size={14} color="#9AA1B9" style={styles.demoInputIcon} />
                      <input
                        type="email" required placeholder="Work email" value={demoEmail}
                        onChange={(e) => setDemoEmail(e.target.value)}
                        style={styles.demoInput}
                      />
                    </div>
                    <div style={{ ...styles.demoInputWrap, flex: 1 }}>
                      <Users size={14} color="#9AA1B9" style={styles.demoInputIcon} />
                      <select
                        value={demoTeamSize} onChange={(e) => setDemoTeamSize(e.target.value)}
                        style={{ ...styles.demoInput, paddingLeft: 34, appearance: "none" }}
                      >
                        {TEAM_SIZE_OPTIONS.map((t) => <option key={t} value={t}>{t} people</option>)}
                      </select>
                    </div>
                  </div>
                  <textarea
                    placeholder="What else would you like to tell us? (optional)"
                    value={demoMessage} onChange={(e) => setDemoMessage(e.target.value)}
                    rows={2} style={styles.demoTextarea}
                  />
                  <button type="submit" disabled={submitting} className="action-btn" style={{ ...styles.waitlistBtn, width: "100%", justifyContent: "center", opacity: submitting ? 0.75 : 1 }}>
                    {submitting ? "Submitting..." : "Book a Demo"} <ArrowRight size={16} />
                  </button>
                  {demoError && <div style={styles.waitlistErrorText}>{demoError}</div>}
                </form>
              )
            ) : (
              inquirySubmitted ? (
                <div style={styles.successBox}>
                  <CheckCircle2 size={20} color="#17A673" />
                  <span>Thanks! Our sales team will follow up on your inquiry shortly.</span>
                </div>
              ) : (
                <form onSubmit={handleInquirySubmit} className="lp-demo-form" style={styles.demoForm}>
                  <div className="lp-demo-form-row" style={styles.demoFormRow}>
                    <div style={styles.demoInputWrap}>
                      <Users size={14} color="#9AA1B9" style={styles.demoInputIcon} />
                      <input
                        required placeholder="Full name" value={demoName}
                        onChange={(e) => setDemoName(e.target.value)}
                        style={styles.demoInput}
                      />
                    </div>
                    <div style={styles.demoInputWrap}>
                      <Building2 size={14} color="#9AA1B9" style={styles.demoInputIcon} />
                      <input
                        required placeholder="Company name" value={demoCompany}
                        onChange={(e) => setDemoCompany(e.target.value)}
                        style={styles.demoInput}
                      />
                    </div>
                  </div>
                  <div className="lp-demo-form-row" style={styles.demoFormRow}>
                    <div style={{ ...styles.demoInputWrap, flex: 2 }}>
                      <Globe size={14} color="#9AA1B9" style={styles.demoInputIcon} />
                      <input
                        type="email" required placeholder="Work email" value={demoEmail}
                        onChange={(e) => setDemoEmail(e.target.value)}
                        style={styles.demoInput}
                      />
                    </div>
                    <div style={{ ...styles.demoInputWrap, flex: 1 }}>
                      <ClipboardList size={14} color="#9AA1B9" style={styles.demoInputIcon} />
                      <select
                        value={inquiryType} onChange={(e) => setInquiryType(e.target.value)}
                        style={{ ...styles.demoInput, paddingLeft: 34, appearance: "none" }}
                      >
                        {INQUIRY_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <textarea
                    placeholder="What else would you like to tell us?"
                    value={demoMessage} onChange={(e) => setDemoMessage(e.target.value)}
                    rows={2} style={styles.demoTextarea}
                  />
                  <button type="submit" disabled={submitting} className="action-btn" style={{ ...styles.waitlistBtn, width: "100%", justifyContent: "center", opacity: submitting ? 0.75 : 1 }}>
                    {submitting ? "Submitting..." : "Send Inquiry"} <ArrowRight size={16} />
                  </button>
                  {inquiryError && <div style={styles.waitlistErrorText}>{inquiryError}</div>}
                </form>
              )
            )}
          </div>
        </div>
      </section>

      <footer style={styles.footer}>
        <div className="lp-footer-inner" style={styles.footerInner}>
          <div style={{ minWidth: 180 }}>
            <img src="/train-ai-logo.png" alt="Train AI" style={{ height: 38, width: "auto", objectFit: "contain", display: "block", marginBottom: 8 }} />
            <div style={{ fontSize: 12, color: "#656C86", marginTop: 4 }}>Train AI Limited · Lagos · London</div>
            <div style={{ fontSize: 12, color: "#656C86", marginTop: 8 }}>info@trainailtd.com</div>
            <div style={{ fontSize: 12, color: "#656C86" }}>+44 7435126104 · +234 9076664049</div>
          </div>
          <div style={styles.footerSitemap}>
            <span className="lp-footer-link" style={styles.footerLink} onClick={() => handleNav("about")}>About</span>
            <span className="lp-footer-link" style={styles.footerLink} onClick={() => handleNav("platform")}>Platform</span>
            <span className="lp-footer-link" style={styles.footerLink} onClick={() => handleNav("solutions")}>Solutions</span>
            <span className="lp-footer-link" style={styles.footerLink} onClick={() => handleNav("why-train-ai")}>Why Train AI</span>
            <span className="lp-footer-link" style={styles.footerLink} onClick={() => handleNav("pricing")}>Pricing</span>
            <span className="lp-footer-link" style={styles.footerLink} onClick={() => handleNav("organizations")}>For Organisations</span>
            <span className="lp-footer-link" style={styles.footerLink} onClick={() => handleNav("individuals")}>For Individuals</span>
            <span className="lp-footer-link" style={styles.footerLink} onClick={() => handleNav("book-demo")}>Contact</span>
          </div>
          <div className="lp-legal-links" style={{ display: "flex", gap: 16, fontSize: 12.5, color: "#656C86" }}>
            <span className="lp-footer-link" style={{ cursor: "pointer" }} onClick={() => handleNav("privacy")}>Privacy Policy</span>
            <span className="lp-footer-link" style={{ cursor: "pointer" }} onClick={() => handleNav("terms")}>Terms of Service</span>
            <span className="lp-footer-link" style={{ cursor: "pointer" }} onClick={() => handleNav("cookie")}>Cookie Policy</span>
          </div>
        </div>
      </footer>

      {activeModal && (
        <div style={styles.modalOverlay} onClick={() => setActiveModal(null)} role="presentation">
          <div
            style={styles.modalCard}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="lp-modal-title"
          >
            <div style={styles.modalHeader}>
              <h3 id="lp-modal-title" style={styles.modalTitle}>{LEGAL_CONTENT[activeModal].title}</h3>
              <button style={styles.modalClose} onClick={() => setActiveModal(null)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <p style={styles.modalBody}>{LEGAL_CONTENT[activeModal].body}</p>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  outer: { minHeight: "100vh", background: "#F4F6FC", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  header: { background: "#fff", borderBottom: "1px solid #E6E9F5", position: "sticky", top: 0, zIndex: 50 },
  headerInner: { maxWidth: 1140, margin: "0 auto", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" },
  brandRow: { display: "flex", alignItems: "center", gap: 10 },
  brandName: { fontWeight: 800, fontSize: 16, color: "#10142A", lineHeight: 1.1 },
  brandSub: { fontSize: 10.5, fontWeight: 700, color: "#4F46E5", textTransform: "uppercase", letterSpacing: ".06em" },
  navLinks: { display: "flex", gap: 24, alignItems: "center" },
  navLink: { fontSize: 13.5, fontWeight: 600, color: "#656C86", cursor: "pointer" },
  navLinkQuiet: { fontSize: 12.5, fontWeight: 500, color: "#9AA1B9", cursor: "pointer" },
  signInBtn: { border: "1.5px solid #E2E8F0", background: "transparent", padding: "8px 16px", borderRadius: 11, fontWeight: 700, fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" },
  getStartedBtn: { border: "none", background: "linear-gradient(135deg, #4338CA 0%, #4F46E5 50%, #6366F1 100%)", color: "#fff", padding: "9px 18px", borderRadius: 11, fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: "0 4px 14px rgba(79,70,229,0.3)", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 },
  heroSection: { maxWidth: 1080, margin: "0 auto", padding: "60px 20px 80px", textAlign: "center" },
  heroH1: { fontSize: 42, fontWeight: 900, letterSpacing: "-0.03em", color: "#0F172A", margin: "0 0 16px", lineHeight: 1.15 },
  heroSub: { fontSize: 16.5, color: "#475569", maxWidth: 700, margin: "0 auto 10px", lineHeight: 1.5 },
  heroSubBold: { fontSize: 15, color: "#0F172A", fontWeight: 700, maxWidth: 680, margin: "0 auto 30px", lineHeight: 1.5 },
  heroCtaRow: { display: "flex", gap: 12, justifyContent: "center", marginBottom: 14 },
  heroSecondaryBtn: { border: "1.5px solid #E2E8F0", background: "#fff", color: "#0F172A", padding: "9px 18px", borderRadius: 11, fontWeight: 700, fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" },
  heroNote: { fontSize: 12.5, color: "#64748B", fontWeight: 600, marginBottom: 36 },
  waitlistCard: { maxWidth: 560, margin: "0 auto", background: "#fff", padding: 20, borderRadius: 16, border: "1px solid #E2E8F0", boxShadow: "0 20px 40px -16px rgba(15,23,42,.08)" },
  demoForm: { display: "flex", flexDirection: "column", gap: 10 },
  demoFormRow: { display: "flex", gap: 10 },
  demoInputWrap: { position: "relative", flex: 1 },
  demoInputIcon: { position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" },
  demoInput: {
    width: "100%", border: "1.5px solid #E2E8F0", padding: "11px 13px 11px 34px", fontSize: 13.5,
    borderRadius: 11, outline: "none", boxSizing: "border-box", color: "#0F172A", background: "#fff",
  },
  demoTextarea: {
    width: "100%", border: "1.5px solid #E2E8F0", padding: "11px 13px", fontSize: 13.5,
    borderRadius: 11, outline: "none", boxSizing: "border-box", color: "#0F172A", resize: "vertical", fontFamily: "inherit",
  },
  waitlistBtn: { border: "none", background: "linear-gradient(135deg, #4338CA 0%, #4F46E5 50%, #6366F1 100%)", color: "#fff", padding: "12px 20px", borderRadius: 11, fontWeight: 700, fontSize: 13.5, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", boxShadow: "0 4px 14px rgba(79,70,229,0.3)" },
  waitlistErrorText: { padding: "0 2px", fontSize: 12, color: "#EF4444", fontWeight: 600, textAlign: "left" },
  successBox: { display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", fontSize: 13.5, fontWeight: 600, color: "#10B981" },
  grid: { display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 20, textAlign: "left" },
  card: { flex: "1 1 220px", maxWidth: 340, background: "#fff", padding: 22, borderRadius: 18, border: "1px solid #E2E8F0" },
  cardIcon: { width: 42, height: 42, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 },
  cardTitle: { fontSize: 15, fontWeight: 800, margin: "0 0 6px", color: "#0F172A" },
  cardDesc: { fontSize: 12.5, color: "#64748B", margin: 0, lineHeight: 1.45 },
  inlineLink: { fontSize: 12, fontWeight: 700, color: "#4F46E5", marginTop: 12, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" },
  bodyLarge: { fontSize: 15.5, color: "#334155", lineHeight: 1.65, marginBottom: 18 },
  answersLine: { fontSize: 11.5, color: "#94A3B8", fontStyle: "italic", marginTop: 10 },

  section: { padding: "72px 20px" },
  sectionInner: { maxWidth: 1100, margin: "0 auto", textAlign: "center" },
  sectionTag: { display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 14px", borderRadius: 99, background: "#EEF2FF", color: "#4F46E5", fontSize: 12, fontWeight: 700, marginBottom: 16 },
  sectionH2: { fontSize: 28, fontWeight: 900, letterSpacing: "-0.02em", color: "#0F172A", margin: "0 0 10px", lineHeight: 1.2 },
  sectionSub: { fontSize: 14.5, color: "#64748B", maxWidth: 640, margin: "0 auto 40px", lineHeight: 1.55 },

  statBanner: { maxWidth: 680, margin: "0 auto 40px", padding: "18px 24px", background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 14, fontSize: 14, color: "#991B1B", lineHeight: 1.5 },

  stepsRow: { display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 20, textAlign: "left" },
  stepCard: { flex: "1 1 240px", maxWidth: 320, position: "relative", background: "#fff", padding: "26px 22px 22px", borderRadius: 18, border: "1px solid #E2E8F0" },
  stepNumber: { position: "absolute", top: 16, right: 18, fontSize: 12, fontWeight: 800, color: "#C7D2FE" },
  stepIcon: { width: 42, height: 42, borderRadius: 12, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 },

  featuresGrid: { display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 20, textAlign: "left" },

  questionGrid: { display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", marginTop: 20 },
  questionPill: { background: "#fff", border: "1px solid #E2E8F0", borderRadius: 99, padding: "10px 18px", fontSize: 13, fontWeight: 700, color: "#0F172A" },

  comparisonWrap: { overflowX: "auto", marginTop: 8 },
  comparisonTable: { width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 14, overflow: "hidden", border: "1px solid #E2E8F0" },
  comparisonHeaderCell: { textAlign: "left", padding: "12px 18px", fontSize: 12.5, fontWeight: 800, color: "#64748B", borderBottom: "1px solid #E2E8F0", background: "#F8FAFC" },
  comparisonCellLabel: { textAlign: "left", padding: "12px 18px", fontSize: 13, fontWeight: 700, color: "#0F172A", borderBottom: "1px solid #E2E8F0" },
  comparisonCell: { textAlign: "left", padding: "12px 18px", fontSize: 13, color: "#64748B", borderBottom: "1px solid #E2E8F0" },

  pricingGrid: { display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 20, textAlign: "left", marginTop: 12 },
  pricingCard: { flex: "1 1 280px", maxWidth: 360, position: "relative", background: "#fff", padding: 26, borderRadius: 18, border: "1px solid #E2E8F0", display: "flex", flexDirection: "column" },
  pricingCardHighlighted: { border: "2px solid #4F46E5", boxShadow: "0 20px 40px -16px rgba(79,70,229,.25)" },
  pricingBadge: { position: "absolute", top: -12, left: 24, background: "linear-gradient(135deg, #4338CA, #6366F1)", color: "#fff", fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 99 },
  pricingName: { fontSize: 18, fontWeight: 800, margin: "6px 0 4px", color: "#0F172A" },
  pricingTagline: { fontSize: 12.5, color: "#64748B", margin: "0 0 16px", lineHeight: 1.4, minHeight: 54 },
  pricingPriceRow: { display: "flex", alignItems: "baseline", gap: 6 },
  pricingPrice: { fontSize: 26, fontWeight: 800, color: "#0F172A" },
  pricingNote: { fontSize: 11.5, color: "#94A3B8", margin: "2px 0 18px" },
  pricingFeatureList: { listStyle: "none", padding: 0, margin: "0 0 22px", display: "flex", flexDirection: "column", gap: 10, flex: 1 },
  pricingFeatureItem: { display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12.5, color: "#334155", lineHeight: 1.4 },
  pricingOutlineBtn: { border: "1.5px solid #4F46E5", background: "#fff", color: "#4F46E5", padding: "9px 18px", borderRadius: 11, fontWeight: 700, fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 },

  contactModeToggle: { display: "inline-flex", background: "rgba(255,255,255,.12)", borderRadius: 12, padding: 4, gap: 4, marginBottom: 20 },
  contactModeBtn: { border: "none", background: "transparent", color: "rgba(255,255,255,.75)", padding: "8px 16px", borderRadius: 9, fontWeight: 700, fontSize: 12.5, cursor: "pointer" },
  contactModeBtnActive: { border: "none", background: "#fff", color: "#0F172A", padding: "8px 16px", borderRadius: 9, fontWeight: 700, fontSize: 12.5, cursor: "pointer" },

  faqList: { display: "flex", flexDirection: "column", gap: 10, textAlign: "left" },
  faqItem: { background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 14, padding: "4px 18px" },
  faqQuestion: {
    width: "100%", border: "none", background: "transparent", cursor: "pointer", padding: "14px 0",
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
    fontSize: 14, fontWeight: 700, color: "#0F172A", textAlign: "left"
  },
  faqAnswer: { margin: "0 0 16px", fontSize: 13, color: "#64748B", lineHeight: 1.55 },

  ctaSection: { padding: "72px 20px", background: "linear-gradient(135deg, #0F172A 0%, #312E81 50%, #4338CA 100%)" },

  footer: { borderTop: "1px solid #E2E8F0", background: "#fff", padding: "32px 20px" },
  footerInner: { maxWidth: 1140, margin: "0 auto", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 24 },
  footerSitemap: { display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5 },
  footerLink: { color: "#64748B", cursor: "pointer" },

  modalOverlay: { position: "fixed", inset: 0, background: "rgba(15,23,42,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 100, overflowY: "auto", boxSizing: "border-box" },
  modalCard: { background: "#fff", borderRadius: 18, padding: 24, maxWidth: 460, width: "100%", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 30px 60px -24px rgba(15,23,42,.35)" },
  modalHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  modalTitle: { fontSize: 17, fontWeight: 800, color: "#0F172A", margin: 0 },
  modalClose: { border: "none", background: "#F8FAFC", borderRadius: 8, padding: 6, cursor: "pointer", display: "flex" },
  modalBody: { fontSize: 13.5, color: "#64748B", lineHeight: 1.55, margin: 0 }
};
