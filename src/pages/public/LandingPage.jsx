import React, { useEffect, useState } from "react";
import {
  ArrowRight, BarChart3, BookOpen, Brain, Building2, Check, ChevronDown,
  ChevronLeft, ChevronRight, GraduationCap, Heart, Instagram, Layers, Lock, Mail, Menu, MessageSquare, Target,
  UserCog, Users, X,
} from "lucide-react";
import { captureAttributionFromURL } from "../../lib/api/waitlist.js";
import { trackReferralClickIfPresent } from "../../lib/api/organizations.js";
import PlatformScreensTour from "./PlatformScreensTour.jsx";

const LEARNER_FEATURES = [
  [BookOpen, "Structured learning", "Complete assigned courses and follow a clear learning path without losing track of the next step."],
  [Users, "Cohorts and study groups", "Learn with a community, take part in cohort activity, and collaborate in focused study groups."],
  [MessageSquare, "Instructor connection", "Receive guidance and communicate directly with instructors inside the learning environment."],
  [Brain, "AI learning support", "Use the AI coach for course support and assessment preparation, with insights tailored to individual progress."],
];

const ORGANISATION_FEATURES = [
  [Layers, "End-to-end learning management", "Manage courses, cohorts, learners, communities and instructors from one operational workspace."],
  [BarChart3, "Performance and impact visibility", "Follow cohort performance and connect learning activity to outcomes that programme and business teams can use."],
  [Target, "Workforce intelligence", "Identify skill gaps, monitor readiness scores and see where teams or learners need additional development."],
  [UserCog, "Manager and instructor oversight", "Give managers useful AI summaries and comment logs while instructors manage delivery and learner support."],
];

const AUDIENCES = [
  [GraduationCap, "Academies and training providers", "Move physical or fragmented training online, coordinate instructors and cohorts, and understand learner progress in one place."],
  [Heart, "Foundations and social-impact organisations", "Manage learning communities and cohorts end to end, while measuring participation, development and programme impact centrally."],
  [Building2, "Businesses and enterprise teams", "Develop people against organisational needs and use skill-gap and readiness information to guide workforce decisions."],
];

const CURRENCY_CONFIG = {
  NGN: { key: "NGN", label: "NGN (₦)", symbol: "₦" },
  USD: { key: "USD", label: "USD ($)", symbol: "$" },
  GBP: { key: "GBP", label: "GBP (£)", symbol: "£" },
  EUR: { key: "EUR", label: "EUR (€)", symbol: "€" },
};

const PRICING_TIERS = [
  {
    name: "Basic",
    tierKey: "basic",
    prices: { NGN: "₦250,000", USD: "$250", GBP: "£190", EUR: "€220" },
    period: "/ month",
    seatSummary: "1 Admin · 1 Instructor · 20 Learners",
    extraSeatNote: { NGN: "+₦15,000 / addtl. learner", USD: "+$15 / addtl. learner", GBP: "+£12 / addtl. learner", EUR: "+€14 / addtl. learner" },
    creditsBadge: "220 AI Credits",
    description: "A focused starting point for organisations bringing structured learning, learners and cohorts into one system.",
    features: [
      "1 Admin & 1 Instructor seat",
      "20 Learners included",
      "Additional learners: ₦15k / $15 per seat",
      "220 AI Credits for entire organisation",
      "Default colours & standard UI (no custom branding)",
      "Structured course delivery & cohort management",
      "Study groups & peer community feed",
      "Core progress & completion tracking",
    ],
  },
  {
    name: "Intermediate",
    tierKey: "intermediate",
    prices: { NGN: "₦500,000", USD: "$500", GBP: "£400", EUR: "€440" },
    period: "/ month",
    seatSummary: "Multiple Admins & Instructors · Manager View · 30 Learners",
    extraSeatNote: { NGN: "+₦10,000 / addtl. seat", USD: "+$10 / addtl. seat", GBP: "+£8 / addtl. seat", EUR: "+€9 / addtl. seat" },
    creditsBadge: "400 AI Credits",
    description: "For organisations that need deeper learning support, manager oversight, custom branding, and workforce intelligence.",
    features: [
      "Multiple Admin & Instructor seats",
      "Manager view & role access permissions",
      "30 Learners included",
      "Additional seats: ₦10k / $10 per seat",
      "400 AI Credits for entire organisation",
      "Custom organisation branding & colors on Train AI",
      "Workforce intelligence & skill-gap tracking",
      "Data download (CSV / JSON reports)",
    ],
  },
  {
    name: "Advanced / Enterprise",
    tierKey: "enterprise",
    prices: { NGN: "Custom", USD: "Custom", GBP: "Custom", EUR: "Custom" },
    period: "Contact our sales team",
    seatSummary: "Multiple Admins, Managers & Instructors · Custom Learners",
    extraSeatNote: { NGN: "Tailored seat volume", USD: "Tailored seat volume", GBP: "Tailored seat volume", EUR: "Tailored seat volume" },
    creditsBadge: "Custom AI Quota",
    description: "A fully configurable engagement for enterprises, foundations and institutions with advanced security, SSO, and API connection.",
    features: [
      "Multiple Admins, Managers, and Instructors",
      "Custom / Unlimited learner volume",
      "Custom AI Credits & dedicated organisation quota",
      "Full customisation & white-labelling",
      "Workforce Intelligence & talent readiness mapping",
      "Data download & compliance audit reports",
      "API connection, SSO (Single Sign-On), & webhooks",
      "Dedicated account manager & SLA support",
    ],
  },
];


const FAQ_ITEMS = [
  ["What is Train AI?", "Train AI is an AI learning and development platform that brings learning delivery, cohort and community management, learner support, administration and measurable outcomes into one system."],
  ["Who is the platform for?", "Train AI is designed for academies and training providers, foundations and social-impact organisations, and businesses developing their workforce."],
  ["What do learners get?", "Learners can complete structured courses, join cohorts and study groups, communicate with instructors, take part in leaderboards, use an AI coach for learning and assessment preparation, and receive personalised insights."],
  ["What can organisations manage?", "Organisations can manage learners, courses, cohorts, communities and instructors, monitor cohort performance, track skill gaps and readiness, and give managers access to AI summaries and administrative comment logs."],
  ["How does pricing work?", "Train AI uses three standard tiers: Basic, Intermediate and Customizable Enterprise (with SSO). The right tier and commercial terms are discussed during a product demo based on your organisation's requirements."],
  ["How do we get started?", "Click 'Book a Demo' to schedule a live 30-minute institutional walkthrough. We will demonstrate the platform and align on configuration, cohort setup, and deployment timeline."],
];

const LEGAL_CONTENT = {
  about: ["About Train AI", "Train AI is an AI learning and development platform for organisations. It centralises learning delivery, cohort and community management, learner support, administration and outcome visibility so development can be managed from one place."],
  privacy: ["Privacy Policy", "Train AI uses organisational and learner data to provide the platform's learning, administration and reporting services. Access is controlled by role and organisation. For privacy enquiries, contact info@trainailtd.com."],
  terms: ["Terms of Service", "Use of Train AI is governed by the agreement associated with an organisation's selected plan and implementation. For commercial or contractual enquiries, contact info@trainailtd.com."],
  cookie: ["Cookie Policy", "Train AI uses necessary browser storage for secure sessions and essential platform functions. Optional analytics and marketing storage are controlled through the site's consent preferences."],
};

function FeatureList({ features }) {
  return (
    <div className="lp-feature-list">
      {features.map(([Icon, title, description]) => (
        <article key={title} className="lp-feature-row">
          <Icon size={20} aria-hidden="true" />
          <div><h4>{title}</h4><p>{description}</p></div>
        </article>
      ))}
    </div>
  );
}

export default function LandingPage({ onNavigate }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  const [legalModal, setLegalModal] = useState(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [currency, setCurrency] = useState("NGN");


  const showcasePhotos = [
    { src: "/images/train-ai-diverse-learners.jpg", title: "Enterprise & Foundation Cohorts", caption: "Multi-racial teams collaborating across AI and technical training tracks." },
    { src: "/images/train-ai-women-tech.jpg", title: "Women in Technology Programs", caption: "Community-driven learning tracks with peer accountability and mentor reviews." },
    { src: "/images/train-ai-diverse-team.jpg", title: "Workforce & NGO Development", caption: "Structured development cohorts measuring skills, readiness, and impact." },
    { src: "/images/train-ai-white-team.jpg", title: "Collaborative Planning Sprints", caption: "Instructor-led sessions and hands-on portfolio milestones." },
  ];

  const handlePrevPhoto = () => {
    setPhotoIndex((curr) => (curr === 0 ? showcasePhotos.length - 1 : curr - 1));
  };

  const handleNextPhoto = () => {
    setPhotoIndex((curr) => (curr === showcasePhotos.length - 1 ? 0 : curr + 1));
  };

  useEffect(() => {
    captureAttributionFromURL();
    const referral = new URLSearchParams(window.location.search).get("ref");
    if (referral) trackReferralClickIfPresent(referral);
  }, []);

  useEffect(() => {
    const page = document.querySelector(".lp-page");
    if (!page || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const revealTargets = page.querySelectorAll([
      ".lp-section-heading",
      ".lp-two-column-feature",
      ".lp-screens-section",
      ".pst-carousel-container",
      ".lp-outcomes-grid",
      ".lp-photo-ribbon",
      ".lp-audience-row",
      ".lp-pricing-tier",
      ".lp-demo-grid",
      ".lp-faq-intro",
      ".lp-faq-list",
    ].join(","));

    page.classList.add("lp-motion-ready");
    revealTargets.forEach((element) => element.classList.add("lp-reveal"));

    if (!("IntersectionObserver" in window)) {
      revealTargets.forEach((element) => element.classList.add("lp-reveal-visible"));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("lp-reveal-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6%" });

    revealTargets.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!legalModal) return;
    const closeOnEscape = (event) => event.key === "Escape" && setLegalModal(null);
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [legalModal]);

  function navigate(target, data) {
    setMenuOpen(false);
    if (typeof onNavigate === "function") return onNavigate(target, data);
    window.location.href = target === "book-demo" ? "/?view=book-demo" : "/?view=auth";
  }

  function scrollToSection(id) {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="lp-page">
      <style>{landingStyles}</style>

      <header className="lp-header">
        <div className="lp-header-inner">
          <button className="lp-logo-button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Train AI home">
            <img src="/train-ai-logo.png" alt="Train AI" />
          </button>
          <nav className="lp-nav" aria-label="Main navigation">
            <button onClick={() => scrollToSection("platform")}>Platform</button>
            <button onClick={() => scrollToSection("screens")}>Have a look</button>
            <button onClick={() => scrollToSection("organisations")}>Who it is for</button>
            <button onClick={() => scrollToSection("pricing")}>Pricing</button>
            <button onClick={() => scrollToSection("faq")}>FAQ</button>
          </nav>
          <div className="lp-header-actions">
            <button className="lp-text-button" onClick={() => navigate("signin")}>Sign in</button>
            <button className="lp-primary-button lp-small-button" onClick={() => navigate("book-demo")}>Book a demo</button>
          </div>
          <button className="lp-menu-button" onClick={() => setMenuOpen((value) => !value)} aria-label="Toggle navigation" aria-expanded={menuOpen}>
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {menuOpen && (
          <div className="lp-mobile-nav">
            <button onClick={() => scrollToSection("platform")}>Platform</button>
            <button onClick={() => scrollToSection("screens")}>Have a look</button>
            <button onClick={() => scrollToSection("organisations")}>Who it is for</button>
            <button onClick={() => scrollToSection("pricing")}>Pricing</button>
            <button onClick={() => scrollToSection("faq")}>FAQ</button>
            <button onClick={() => navigate("signin")}>Sign in</button>
            <button className="lp-primary-button" onClick={() => navigate("book-demo")}>Book a demo</button>
          </div>
        )}
      </header>

      <main>
        <section className="lp-hero">
          <div className="lp-shell lp-hero-grid">
            <div className="lp-hero-copy">
              <p className="lp-kicker">AI learning and development platform</p>
              <h1>Manage learning. Support people. Measure what changes.</h1>
              <p className="lp-hero-description">Train AI gives organisations one place to deliver courses, run cohorts and learning communities, support learners and instructors, and understand development outcomes.</p>
              <div className="lp-hero-actions">
                <button className="lp-primary-button" onClick={() => navigate("book-demo")}>Book a personalised demo <ArrowRight size={17} /></button>
                <button className="lp-secondary-button" onClick={() => scrollToSection("platform")}>See the platform</button>
              </div>
              <p className="lp-sales-note">Built for organisational customers. Commercial terms are discussed after a product demo.</p>
            </div>
            <figure className="lp-hero-figure">
              <img src="/images/train-ai-diverse-learners.jpg" alt="A diverse group of adult learners collaborating around a laptop" />
              <figcaption><strong>One connected learning operation</strong><span>Courses · Cohorts · Community · Intelligence</span></figcaption>
            </figure>
          </div>
        </section>

        <section id="platform" className="lp-section">
          <div className="lp-shell">
            <div className="lp-section-heading lp-heading-split">
              <p className="lp-kicker">The platform</p>
              <h2>Learning delivery and development intelligence belong in the same system.</h2>
              <p>Train AI connects the day-to-day work of learning, including courses, cohorts, communities and support, with the information organisations need to improve programmes and develop people.</p>
            </div>
            <div className="lp-two-column-feature">
              <div className="lp-feature-column">
                <div className="lp-column-title"><span>For learners</span><h3>A clear place to learn, practise and stay connected.</h3></div>
                <FeatureList features={LEARNER_FEATURES} />
              </div>
              <div className="lp-feature-column lp-feature-column-dark">
                <div className="lp-column-title"><span>For organisations</span><h3>Visibility across the full development process.</h3></div>
                <FeatureList features={ORGANISATION_FEATURES} />
              </div>
            </div>
          </div>
        </section>

        <PlatformScreensTour />

        <section className="lp-section lp-outcomes-section">
          <div className="lp-shell lp-outcomes-grid">
            <div><p className="lp-kicker">From activity to outcomes</p><h2>Know what is happening across learning, not just who logged in.</h2></div>
            <div className="lp-outcome-copy">
              <p>Bring course progress, cohort performance, instructor activity, learner development and community participation into one operational view.</p>
              <p>Use skill-gap information, readiness scores, AI summaries and manager notes to decide where support or further development is needed.</p>
            </div>
          </div>
        </section>

        <section id="organisations" className="lp-section">
          <div className="lp-shell">
            <div className="lp-section-heading">
              <p className="lp-kicker">Who Train AI is for</p>
              <h2>One platform, applied to different learning operations.</h2>
              <p>The core platform stays consistent. Implementation is shaped around how each organisation delivers learning and measures development.</p>
            </div>

            {/* Foundation Showcase with Interactive Scrolling Arrows */}
            <div className="lp-showcase-container" aria-label="Learning and collaboration in practice">
              <div className="lp-showcase-frame">
                <img
                  src={showcasePhotos[photoIndex].src}
                  alt={showcasePhotos[photoIndex].title}
                  className="lp-showcase-img"
                  loading="lazy"
                />
                <div className="lp-showcase-overlay">
                  <div className="lp-showcase-text">
                    <strong>{showcasePhotos[photoIndex].title}</strong>
                    <span>{showcasePhotos[photoIndex].caption}</span>
                  </div>
                  <div className="lp-showcase-controls">
                    <button
                      className="lp-showcase-arrow"
                      onClick={handlePrevPhoto}
                      aria-label="Previous image"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <div className="lp-showcase-dots">
                      {showcasePhotos.map((_, idx) => (
                        <button
                          key={idx}
                          className={`lp-showcase-dot ${idx === photoIndex ? "active" : ""}`}
                          onClick={() => setPhotoIndex(idx)}
                          aria-label={`Slide ${idx + 1}`}
                        />
                      ))}
                    </div>
                    <button
                      className="lp-showcase-arrow"
                      onClick={handleNextPhoto}
                      aria-label="Next image"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="lp-audience-list">
              {AUDIENCES.map(([Icon, title, description], index) => (
                <article key={title} className="lp-audience-row">
                  <span className="lp-audience-number">0{index + 1}</span><Icon size={24} aria-hidden="true" /><h3>{title}</h3><p>{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="lp-section lp-pricing-section">
          <div className="lp-shell">
            <div className="lp-section-heading lp-heading-split">
              <p className="lp-kicker">Standard pricing structure</p>
              <h2>Three tiers. The same framework for every organisation type.</h2>
              <p>Transparent monthly subscriptions for cohorts, academies, foundations and enterprise teams. Toggle currency to view local rates.</p>
            </div>

            {/* Currency Selector */}
            <div className="lp-currency-selector-bar">
              <span className="lp-currency-label">Select Billing Currency:</span>
              <div className="lp-currency-pill-group">
                {Object.values(CURRENCY_CONFIG).map((c) => (
                  <button
                    key={c.key}
                    className={`lp-currency-pill ${currency === c.key ? "active" : ""}`}
                    onClick={() => setCurrency(c.key)}
                    aria-pressed={currency === c.key}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="lp-pricing-table">
              {PRICING_TIERS.map((tier, index) => {
                const currentPrice = tier.prices[currency] || tier.prices.NGN;
                const isEnterprise = tier.tierKey === "enterprise";
                return (
                  <article key={tier.name} className={`lp-pricing-tier ${isEnterprise ? "lp-pricing-tier-enterprise" : ""}`}>
                    <div className="lp-tier-heading">
                      <span>0{index + 1}</span>
                      <h3>{tier.name}</h3>
                    </div>

                    <div className="lp-tier-price-block">
                      <div className="lp-tier-price-row">
                        <span className="lp-tier-amount">{currentPrice}</span>
                        <span className="lp-tier-period">{tier.period}</span>
                      </div>
                      <div className="lp-tier-seats-summary">{tier.seatSummary}</div>
                      <div className="lp-tier-badge-row">
                        <span className="lp-tier-credit-badge">{tier.creditsBadge}</span>
                        <span className="lp-tier-extra-note">{tier.extraSeatNote[currency]}</span>
                      </div>
                    </div>

                    <p className="lp-tier-desc">{tier.description}</p>

                    <ul className="lp-tier-features">
                      {tier.features.map((feature) => (
                        <li key={feature}>
                          <Check size={16} />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <button
                      className={isEnterprise ? "lp-primary-button" : "lp-secondary-button"}
                      onClick={() => navigate("book-demo", { sector: tier.name.toLowerCase() })}
                    >
                      {isEnterprise ? "Contact sales team" : `Get started with ${tier.name}`} <ArrowRight size={16} />
                    </button>
                  </article>
                );
              })}
            </div>
            <p className="lp-pricing-note">All plans include secure cloud infrastructure, automated backups, and 99.9% uptime. Custom configurations and multi-year SLAs confirmed during onboarding.</p>
          </div>
        </section>


        <section className="lp-section lp-demo-section">
          <div className="lp-shell lp-demo-grid">
            <div><p className="lp-kicker">A useful first conversation</p><h2>See Train AI against your real learning operation.</h2></div>
            <div><p>A personalised demo lets us understand your learners, delivery model and reporting needs before discussing configuration or commercial terms.</p><button className="lp-primary-button lp-light-button" onClick={() => navigate("book-demo")}>Choose a demo time <ArrowRight size={17} /></button></div>
          </div>
        </section>

        <section id="faq" className="lp-section">
          <div className="lp-shell lp-faq-grid">
            <div className="lp-faq-intro"><p className="lp-kicker">Frequently asked questions</p><h2>Straight answers about the platform.</h2><p>For questions specific to your organisation, book a product demo and we will address them in context.</p></div>
            <div className="lp-faq-list">
              {FAQ_ITEMS.map(([question, answer], index) => {
                const isOpen = openFaq === index;
                return <div className="lp-faq-item" key={question}><button onClick={() => setOpenFaq(isOpen ? null : index)} aria-expanded={isOpen}><span>{question}</span><ChevronDown size={19} style={{ transform: isOpen ? "rotate(180deg)" : "none" }} /></button>{isOpen && <p>{answer}</p>}</div>;
              })}
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-shell">
          <div className="lp-footer-main">
            <div className="lp-footer-brand">
              <img src="/train-ai-logo.png" alt="Train AI" />
              <p>AI learning and development for organisations.</p>
              <span>Deliver learning, support people and understand development outcomes from one connected platform.</span>
            </div>
            <div className="lp-footer-column">
              <h3>Platform</h3>
              <button onClick={() => scrollToSection("screens")}>Have a look</button>
              <button onClick={() => scrollToSection("platform")}>For learners</button>
              <button onClick={() => scrollToSection("platform")}>For organisations</button>
              <button onClick={() => scrollToSection("pricing")}>Pricing tiers</button>
              <button onClick={() => navigate("book-demo")}>Book a demo</button>
            </div>
            <div className="lp-footer-column">
              <h3>Company</h3>
              <button onClick={() => setLegalModal("about")}>About Train AI</button>
              <button onClick={() => scrollToSection("organisations")}>Who it is for</button>
              <button onClick={() => scrollToSection("faq")}>Frequently asked questions</button>
              <button onClick={() => navigate("signin")}>Customer sign in</button>
            </div>
            <div className="lp-footer-column lp-footer-contact">
              <h3>Contact</h3>
              <a href="mailto:info@trainailtd.com"><Mail size={16} />info@trainailtd.com</a>
              <a href="https://www.instagram.com/trainailtd/" target="_blank" rel="noreferrer"><Instagram size={16} />Instagram <span>@trainailtd</span></a>
              <button className="lp-footer-demo-link" onClick={() => navigate("book-demo")}>Schedule a product conversation <ArrowRight size={14} /></button>
            </div>
          </div>
          <div className="lp-footer-bottom"><span>© 2026 Train AI Ltd. All rights reserved.</span><div><button onClick={() => setLegalModal("privacy")}>Privacy</button><button onClick={() => setLegalModal("terms")}>Terms</button><button onClick={() => setLegalModal("cookie")}>Cookies</button></div></div>
        </div>
      </footer>

      {legalModal && (
        <div className="lp-modal-overlay" onClick={() => setLegalModal(null)} role="presentation">
          <div className="lp-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="legal-title">
            <button className="lp-modal-close" onClick={() => setLegalModal(null)} aria-label="Close"><X size={18} /></button><Lock size={22} />
            <h2 id="legal-title">{LEGAL_CONTENT[legalModal][0]}</h2><p>{LEGAL_CONTENT[legalModal][1]}</p>
          </div>
        </div>
      )}
    </div>
  );
}

const landingStyles = `
  :root{--lp-blue:#2459d3;--lp-blue-dark:#1945ad;--lp-ink:#101828;--lp-muted:#536174;--lp-line:#d9e0e8;--lp-soft:#f4f7fa;--lp-white:#fff}
  .lp-page{min-height:100vh;background:#fff;color:var(--lp-ink);font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.lp-page *{box-sizing:border-box}.lp-page button{font:inherit}.lp-shell{width:min(1160px,calc(100% - 40px));margin:0 auto}
  .lp-header{position:sticky;top:0;z-index:50;background:rgba(255,255,255,.96);border-bottom:1px solid var(--lp-line);backdrop-filter:blur(10px)}.lp-header-inner{width:min(1160px,calc(100% - 40px));height:70px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:30px}.lp-logo-button{border:0;background:transparent;padding:0;cursor:pointer}.lp-logo-button img{display:block;width:auto;height:28px}.lp-nav{display:flex;align-items:center;gap:30px;margin-left:auto}.lp-nav button,.lp-text-button,.lp-footer button{border:0;background:transparent;color:#354154;padding:6px 0;cursor:pointer;font-size:14px;font-weight:600}.lp-nav button:hover,.lp-text-button:hover{color:var(--lp-blue)}.lp-header-actions{display:flex;align-items:center;gap:16px}
  .lp-primary-button,.lp-secondary-button{min-height:44px;display:inline-flex;align-items:center;justify-content:center;gap:9px;border-radius:6px;padding:11px 18px;border:1px solid transparent;cursor:pointer;font-weight:750;font-size:14px;transition:background-color .2s ease,border-color .2s ease,color .2s ease,transform .2s ease,box-shadow .2s ease}.lp-primary-button{color:#fff;background:var(--lp-blue)}.lp-primary-button:hover{background:var(--lp-blue-dark);transform:translateY(-2px);box-shadow:0 8px 20px rgba(36,89,211,.2)}.lp-secondary-button{color:var(--lp-ink);background:#fff;border-color:#bfc8d4}.lp-secondary-button:hover{border-color:#7f8b9b;background:#f8fafc;transform:translateY(-2px)}.lp-small-button{min-height:38px;padding:8px 14px}.lp-menu-button{display:none;border:0;background:transparent;color:var(--lp-ink);padding:7px;cursor:pointer}.lp-mobile-nav{display:none}
  .lp-hero{padding:72px 0 78px;border-bottom:1px solid var(--lp-line);overflow:hidden}.lp-hero-grid{display:grid;grid-template-columns:minmax(0,.94fr) minmax(0,1.06fr);align-items:center;gap:64px}.lp-kicker{margin:0 0 18px;color:var(--lp-blue);text-transform:uppercase;letter-spacing:.13em;font-size:12px;font-weight:800}.lp-hero h1{max-width:690px;margin:0;font-size:clamp(44px,5.4vw,70px);line-height:1.01;letter-spacing:-.052em;font-weight:790}.lp-hero-description{max-width:620px;margin:26px 0 0;color:var(--lp-muted);font-size:18px;line-height:1.65}.lp-hero-actions{display:flex;flex-wrap:wrap;gap:11px;margin-top:30px}.lp-sales-note{margin:17px 0 0;color:#6b7686;font-size:12.5px}.lp-hero-figure{margin:0;overflow:hidden}.lp-hero-figure img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;object-position:center;border-radius:4px;transition:transform .8s cubic-bezier(.2,.7,.2,1)}.lp-hero-figure:hover img{transform:scale(1.025)}.lp-hero-figure figcaption{display:flex;align-items:baseline;justify-content:space-between;gap:16px;padding:14px 0;border-bottom:1px solid var(--lp-line)}.lp-hero-figure strong{font-size:13px}.lp-hero-figure span{color:var(--lp-muted);font-size:12px;text-align:right}
  .lp-section{padding:88px 0;scroll-margin-top:70px}.lp-section-heading{max-width:760px;margin-bottom:46px}.lp-section-heading h2,.lp-outcomes-grid h2,.lp-demo-grid h2,.lp-faq-intro h2{margin:0;font-size:clamp(32px,4vw,50px);line-height:1.08;letter-spacing:-.04em;font-weight:760}.lp-section-heading>p:last-child,.lp-faq-intro>p:last-child{margin:20px 0 0;max-width:680px;color:var(--lp-muted);font-size:16px;line-height:1.65}.lp-heading-split{max-width:none;display:grid;grid-template-columns:1fr 1fr;column-gap:70px}.lp-heading-split .lp-kicker{grid-column:1/-1}.lp-heading-split>p:last-child{margin:2px 0 0}
  .lp-two-column-feature{display:grid;grid-template-columns:1fr 1fr;border:1px solid var(--lp-line)}.lp-feature-column{padding:38px}.lp-feature-column-dark{background:#132038;color:#fff}.lp-column-title{padding-bottom:28px;border-bottom:1px solid var(--lp-line)}.lp-feature-column-dark .lp-column-title{border-color:#344159}.lp-column-title span{color:var(--lp-blue);font-size:12px;text-transform:uppercase;letter-spacing:.12em;font-weight:800}.lp-feature-column-dark .lp-column-title span{color:#91b2ff}.lp-column-title h3{margin:10px 0 0;max-width:480px;font-size:27px;line-height:1.25;letter-spacing:-.025em}.lp-feature-list{display:grid}.lp-feature-row{display:grid;grid-template-columns:26px 1fr;gap:15px;padding:24px 0;border-bottom:1px solid var(--lp-line)}.lp-feature-row:last-child{border-bottom:0;padding-bottom:0}.lp-feature-column-dark .lp-feature-row{border-color:#344159}.lp-feature-row svg{color:var(--lp-blue);margin-top:2px}.lp-feature-column-dark .lp-feature-row svg{color:#91b2ff}.lp-feature-row h4{margin:0 0 6px;font-size:16px}.lp-feature-row p{margin:0;color:var(--lp-muted);font-size:14px;line-height:1.6}.lp-feature-column-dark .lp-feature-row p{color:#bdc8d9}
  .lp-outcomes-section{position:relative;overflow:hidden}.lp-outcomes-section::after{content:"";position:absolute;inset:0 0 0 56%;background:linear-gradient(90deg,var(--lp-soft),rgba(244,247,250,.78)),url("/images/train-ai-professional.jpg") center 42%/cover;opacity:.14;pointer-events:none}.lp-outcomes-section .lp-shell{position:relative;z-index:1}.lp-outcomes-section,.lp-pricing-section{background-color:var(--lp-soft);border-block:1px solid var(--lp-line)}.lp-outcomes-grid{display:grid;grid-template-columns:1fr 1fr;gap:90px}.lp-outcome-copy{padding-top:32px}.lp-outcome-copy p{margin:0 0 22px;color:#3e4b5d;font-size:17px;line-height:1.72}.lp-photo-ribbon{display:grid;grid-template-columns:.7fr 1.25fr .7fr;align-items:end;gap:12px;margin:-8px 0 48px}.lp-photo-ribbon-item{position:relative;margin:0;overflow:hidden;background:#e9eef4}.lp-photo-ribbon-item img{display:block;width:100%;height:220px;object-fit:cover}.lp-photo-ribbon-item-muted img{height:172px;filter:grayscale(1);opacity:.58}.lp-photo-ribbon-item-main figcaption{position:absolute;right:0;bottom:0;max-width:340px;padding:14px 16px;color:#fff;background:rgba(15,23,40,.86);font-size:12px;line-height:1.5}.lp-audience-list{border-top:1px solid var(--lp-line)}.lp-audience-row{display:grid;grid-template-columns:50px 38px minmax(210px,.65fr) 1fr;align-items:start;gap:24px;padding:30px 0;border-bottom:1px solid var(--lp-line)}.lp-audience-number{color:#8b96a5;font-size:12px;font-weight:700}.lp-audience-row svg{color:var(--lp-blue)}.lp-audience-row h3{margin:0;font-size:20px;letter-spacing:-.02em}.lp-audience-row p{margin:0;color:var(--lp-muted);font-size:15px;line-height:1.65}
  .lp-showcase-container{margin:-8px 0 48px;width:100%}.lp-showcase-frame{position:relative;width:100%;height:380px;border-radius:12px;overflow:hidden;background:#101828;border:1px solid var(--lp-line);box-shadow:0 10px 30px rgba(0,0,0,.08)}.lp-showcase-img{width:100%;height:100%;object-fit:cover;object-position:center;transition:transform .5s ease,opacity .4s ease}.lp-showcase-overlay{position:absolute;inset:auto 0 0 0;background:linear-gradient(180deg,transparent 0%,rgba(15,23,40,.92) 100%);padding:24px 28px;display:flex;align-items:flex-end;justify-content:space-between;gap:20px}.lp-showcase-text strong{display:block;color:#fff;font-size:18px;font-weight:750;margin-bottom:4px}.lp-showcase-text span{display:block;color:#cbd5e1;font-size:13.5px;max-width:540px;line-height:1.5}.lp-showcase-controls{display:flex;align-items:center;gap:12px;flex-shrink:0}.lp-showcase-arrow{width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.2);color:#fff;border:1px solid rgba(255,255,255,.3);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .2s ease;backdrop-filter:blur(6px)}.lp-showcase-arrow:hover{background:var(--lp-blue);border-color:var(--lp-blue);transform:scale(1.08)}.lp-showcase-dots{display:flex;align-items:center;gap:6px}.lp-showcase-dot{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.4);border:0;padding:0;cursor:pointer;transition:all .2s ease}.lp-showcase-dot.active{width:22px;border-radius:4px;background:#38bdf8}
  .lp-currency-selector-bar{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin:0 0 24px;padding:12px 18px;background:#fff;border:1px solid var(--lp-line);border-radius:8px}.lp-currency-label{font-size:13px;font-weight:700;color:var(--lp-muted)}.lp-currency-pill-group{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.lp-currency-pill{padding:6px 14px;border-radius:20px;border:1px solid var(--lp-line);background:#f8fafc;color:#475569;font-size:12.5px;font-weight:700;cursor:pointer;transition:all .2s ease}.lp-currency-pill:hover{background:#edf2f7;color:var(--lp-ink)}.lp-currency-pill.active{background:var(--lp-blue);color:#fff;border-color:var(--lp-blue);box-shadow:0 2px 8px rgba(36,89,211,.25)}
  .lp-pricing-table{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid var(--lp-line);background:#fff;border-radius:8px;overflow:hidden}.lp-pricing-tier{display:flex;flex-direction:column;min-height:560px;padding:32px;border-right:1px solid var(--lp-line);position:relative}.lp-pricing-tier-enterprise{border-right:0;background:#101d36;color:#fff}.lp-tier-heading{display:flex;align-items:baseline;justify-content:space-between;padding-bottom:16px;border-bottom:1px solid var(--lp-line)}.lp-pricing-tier-enterprise .lp-tier-heading{border-color:#2a3b5a}.lp-tier-heading span{color:#8894a4;font-size:12px;font-weight:700}.lp-tier-heading h3{margin:0;font-size:24px;letter-spacing:-.02em}
  .lp-tier-price-block{padding:20px 0 16px;border-bottom:1px solid var(--lp-line)}.lp-pricing-tier-enterprise .lp-tier-price-block{border-color:#2a3b5a}.lp-tier-price-row{display:flex;align-items:baseline;gap:8px}.lp-tier-amount{font-size:32px;font-weight:800;letter-spacing:-.03em;color:var(--lp-ink)}.lp-pricing-tier-enterprise .lp-tier-amount{color:#38bdf8}.lp-tier-period{font-size:13px;color:var(--lp-muted);font-weight:600}.lp-pricing-tier-enterprise .lp-tier-period{color:#94a3b8}
  .lp-tier-seats-summary{font-size:12.5px;font-weight:750;color:var(--lp-blue);margin:8px 0 10px}.lp-pricing-tier-enterprise .lp-tier-seats-summary{color:#93c5fd}
  .lp-tier-badge-row{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-top:6px}.lp-tier-credit-badge{display:inline-block;padding:3px 8px;border-radius:4px;background:#e0f2fe;color:#0284c7;font-size:11.5px;font-weight:800;letter-spacing:.02em}.lp-pricing-tier-enterprise .lp-tier-credit-badge{background:#1e3a8a;color:#93c5fd}
  .lp-tier-extra-note{font-size:11.5px;color:#64748b;font-weight:600}.lp-pricing-tier-enterprise .lp-tier-extra-note{color:#cbd5e1}
  .lp-tier-desc{min-height:56px;margin:18px 0 16px;color:var(--lp-muted);font-size:13.5px;line-height:1.55}.lp-pricing-tier-enterprise .lp-tier-desc{color:#cbd5e1}
  .lp-tier-features{display:grid;gap:12px;padding:0;margin:0 0 28px;list-style:none}.lp-tier-features li{display:flex;align-items:flex-start;gap:9px;font-size:13px;line-height:1.4}.lp-tier-features li svg{flex:0 0 auto;color:var(--lp-blue);margin-top:1px}.lp-pricing-tier-enterprise .lp-tier-features li svg{color:#38bdf8}.lp-pricing-tier button{margin-top:auto;width:100%}.lp-pricing-note{margin:20px 0 0;color:#6b7686;font-size:12.5px;text-align:center}

  .lp-demo-section{color:#fff;background:var(--lp-blue)}.lp-demo-grid{display:grid;grid-template-columns:1fr .8fr;gap:90px;align-items:end}.lp-demo-section .lp-kicker{color:#c8d7ff}.lp-demo-grid p:not(.lp-kicker){margin:0 0 24px;color:#e2e9fb;font-size:16px;line-height:1.7}.lp-light-button{color:var(--lp-blue-dark);background:#fff}.lp-light-button:hover{color:#fff;background:#132038}.lp-faq-grid{display:grid;grid-template-columns:.72fr 1fr;gap:90px}.lp-faq-list{border-top:1px solid var(--lp-line)}.lp-faq-item{border-bottom:1px solid var(--lp-line)}.lp-faq-item button{width:100%;display:flex;align-items:center;justify-content:space-between;gap:20px;padding:22px 0;border:0;background:transparent;color:var(--lp-ink);text-align:left;cursor:pointer;font-weight:700;transition:color .2s ease}.lp-faq-item button:hover{color:var(--lp-blue)}.lp-faq-item button svg{color:#687486;transition:transform .2s ease}.lp-faq-item p{margin:-4px 36px 22px 0;color:var(--lp-muted);font-size:14px;line-height:1.68;animation:lp-answer-in .28s ease both}
  .lp-footer{padding:58px 0 24px;color:#fff;background:#0f1728}.lp-footer-main{display:grid;grid-template-columns:1.55fr repeat(3,1fr);gap:60px;padding-bottom:46px}.lp-footer-brand img{display:block;height:36px;width:auto;filter:brightness(0) invert(1)}.lp-footer-brand p{margin:18px 0 10px;color:#fff;font-size:15px;font-weight:700}.lp-footer-brand span{display:block;max-width:320px;color:#9eabba;font-size:13px;line-height:1.65}.lp-footer-column{display:flex;flex-direction:column;align-items:flex-start;gap:12px}.lp-footer-column h3{margin:0 0 7px;color:#fff;font-size:12px;text-transform:uppercase;letter-spacing:.11em}.lp-footer-column button,.lp-footer-column a{display:inline-flex;align-items:center;gap:8px;border:0;background:transparent;color:#b9c4d3;padding:0;text-align:left;text-decoration:none;cursor:pointer;font-size:13px;font-weight:500;line-height:1.5}.lp-footer-column button:hover,.lp-footer-column a:hover{color:#fff}.lp-footer-contact a span{color:#8290a3}.lp-footer-column .lp-footer-demo-link{margin-top:8px;color:#fff;font-weight:700}.lp-footer-bottom{display:flex;align-items:center;justify-content:space-between;gap:30px;padding-top:22px;border-top:1px solid #2d394d;color:#8793a5;font-size:12px}.lp-footer-bottom>div{display:flex;flex-wrap:wrap;gap:24px}.lp-footer button{color:#d7deea}.lp-footer-bottom button{border:0;background:transparent;padding:0;color:#8793a5;cursor:pointer;font-size:12px;font-weight:500}.lp-footer-bottom button:hover{color:#fff}.lp-modal-overlay{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:20px;background:rgba(15,23,40,.68)}.lp-modal{position:relative;width:min(520px,100%);padding:34px;background:#fff;border:1px solid var(--lp-line);border-radius:6px}.lp-modal>svg{color:var(--lp-blue)}.lp-modal h2{margin:14px 0 10px;font-size:24px}.lp-modal p{margin:0;color:var(--lp-muted);line-height:1.7}.lp-modal-close{position:absolute;top:14px;right:14px;border:0;background:transparent;cursor:pointer;color:#687486}
  .lp-motion-ready .lp-hero-copy{animation:lp-hero-copy-in .72s cubic-bezier(.2,.7,.2,1) both}.lp-motion-ready .lp-hero-figure{animation:lp-hero-visual-in .82s .1s cubic-bezier(.2,.7,.2,1) both}.lp-motion-ready .lp-reveal{opacity:0;transform:translateY(26px);transition:opacity .62s ease,transform .62s cubic-bezier(.2,.7,.2,1)}.lp-motion-ready .lp-reveal.lp-reveal-visible{opacity:1;transform:none}.lp-motion-ready .lp-audience-row:nth-child(2),.lp-motion-ready .lp-pricing-tier:nth-child(2){transition-delay:.08s}.lp-motion-ready .lp-audience-row:nth-child(3),.lp-motion-ready .lp-pricing-tier:nth-child(3){transition-delay:.16s}
  @keyframes lp-hero-copy-in{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:none}}@keyframes lp-hero-visual-in{from{opacity:0;transform:translateX(28px) scale(.985)}to{opacity:1;transform:none}}@keyframes lp-answer-in{from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:none}}
  @media(max-width:900px){.lp-nav,.lp-header-actions{display:none}.lp-menu-button{display:inline-flex}.lp-mobile-nav{display:grid;gap:3px;padding:8px 20px 18px;border-top:1px solid var(--lp-line);background:#fff;animation:lp-mobile-menu-in .24s ease both}.lp-mobile-nav>button:not(.lp-primary-button){border:0;background:transparent;padding:12px 0;text-align:left;color:var(--lp-ink);font-weight:650}.lp-hero-grid,.lp-heading-split,.lp-outcomes-grid,.lp-demo-grid,.lp-faq-grid{grid-template-columns:1fr;gap:34px}.lp-hero-copy{max-width:720px}.lp-two-column-feature,.lp-pricing-table{grid-template-columns:1fr}.lp-showcase-frame{height:300px}.lp-showcase-overlay{flex-direction:column;align-items:flex-start;gap:14px}.lp-feature-column-dark{border-top:1px solid var(--lp-line)}.lp-pricing-tier{min-height:auto;border-right:0;border-bottom:1px solid var(--lp-line)}.lp-pricing-tier:last-child{border-bottom:0}.lp-pricing-tier>p{min-height:0}.lp-pricing-tier button{margin-top:12px}.lp-footer-main{grid-template-columns:1.4fr 1fr 1fr;gap:38px}.lp-footer-contact{grid-column:2/4}}@keyframes lp-mobile-menu-in{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
  @media(max-width:640px){.lp-shell,.lp-header-inner{width:min(100% - 28px,1160px)}.lp-header-inner{height:58px}.lp-logo-button img{height:21px}.lp-menu-button{padding:6px}.lp-hero{padding:38px 0 46px}.lp-hero-grid{gap:30px}.lp-kicker{margin-bottom:13px;font-size:10.5px;letter-spacing:.12em}.lp-hero h1{font-size:clamp(34px,9.6vw,42px);line-height:1.06;letter-spacing:-.043em}.lp-hero-description{margin-top:19px;font-size:15px;line-height:1.58}.lp-hero-actions{display:grid;gap:9px;margin-top:24px}.lp-hero-actions button{width:100%;min-height:42px}.lp-sales-note{margin-top:14px;font-size:11.5px;line-height:1.5}.lp-hero-figure figcaption{display:grid;gap:4px;padding:11px 0}.lp-hero-figure strong{font-size:12px}.lp-hero-figure span{font-size:11px;text-align:left}.lp-section{padding:52px 0}.lp-section-heading{margin-bottom:28px}.lp-section-heading h2,.lp-outcomes-grid h2,.lp-demo-grid h2,.lp-faq-intro h2{font-size:clamp(27px,7.6vw,34px);line-height:1.12;letter-spacing:-.035em}.lp-section-heading>p:last-child,.lp-faq-intro>p:last-child{margin-top:15px;font-size:14.5px;line-height:1.58}.lp-heading-split>p:last-child{margin-top:0}.lp-outcomes-section::after{inset:48% 0 0 0;opacity:.08}.lp-outcomes-grid{gap:24px}.lp-outcome-copy{padding-top:0}.lp-outcome-copy p{margin-bottom:16px;font-size:15px;line-height:1.62}.lp-showcase-frame{height:240px}.lp-showcase-text strong{font-size:15px}.lp-showcase-text span{font-size:12px}.lp-feature-column{padding:24px 20px}.lp-column-title{padding-bottom:22px}.lp-column-title h3{font-size:22px;line-height:1.28}.lp-feature-row{grid-template-columns:23px 1fr;gap:12px;padding:19px 0}.lp-feature-row h4{font-size:15px}.lp-feature-row p{font-size:13.5px;line-height:1.55}.lp-audience-row{grid-template-columns:26px 24px 1fr;gap:11px;padding:24px 0}.lp-audience-row h3{font-size:17px;line-height:1.3}.lp-audience-row p{grid-column:3;font-size:13.5px;line-height:1.58}.lp-pricing-tier{padding:24px 20px}.lp-tier-heading h3{font-size:23px}.lp-pricing-tier>p{margin:20px 0;font-size:13.5px}.lp-pricing-tier li{font-size:13px}.lp-demo-grid{gap:24px}.lp-demo-grid p:not(.lp-kicker){font-size:14.5px;line-height:1.6}.lp-faq-grid{gap:28px}.lp-faq-item button{padding:18px 0;font-size:14px}.lp-faq-item p{font-size:13.5px;line-height:1.6}.lp-footer{padding-top:46px}.lp-footer-main{grid-template-columns:1fr 1fr;gap:32px 20px}.lp-footer-brand,.lp-footer-contact{grid-column:1/-1}.lp-footer-brand img{height:29px}.lp-footer-bottom{align-items:flex-start;flex-direction:column}.lp-footer-bottom>div{gap:16px}.lp-modal{padding:28px 22px}.lp-modal h2{font-size:22px}}
  @media(prefers-reduced-motion:reduce){.lp-page *{scroll-behavior:auto!important;transition:none!important;animation:none!important}.lp-motion-ready .lp-reveal{opacity:1!important;transform:none!important}}
`;
