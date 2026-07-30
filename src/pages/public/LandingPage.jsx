import React, { useState } from "react";
import {
  Zap, ArrowRight, BookOpen, GraduationCap, Cpu, ShieldCheck, CheckCircle2, Globe, Heart, X, Crown,
  Brain, Trophy, MessageSquare, Layers, ChevronDown, ChevronUp, Quote, HelpCircle, ClipboardList, UserPlus, Rocket
} from "lucide-react";
import { joinWaitlist, WAITLIST_TIERS } from "../../lib/api/waitlist.js";

const LEGAL_CONTENT = {
  about: {
    title: "About Us",
    body: "Train AI is an AI & tech skills learning platform built by Sara Foundation Africa, combining self-paced learning paths, 1:1 mentorship, and an embedded AI tutor for learners across Africa. For press, partnership, or support enquiries, reach us at info@sarafoundationafrica.com."
  },
  privacy: {
    title: "Privacy Policy",
    body: "Our full Privacy Policy is being finalized. In short: we only collect the data needed to run your account (profile, course progress, and communications you send us), we never sell personal data, and you can request an export or deletion of your data at any time by emailing info@sarafoundationafrica.com."
  },
  terms: {
    title: "Terms of Service",
    body: "Our full Terms of Service are being finalized. In short: Train AI is provided as-is for educational purposes; accounts are personal and non-transferable; and we may update these terms as the platform evolves. Questions: info@sarafoundationafrica.com."
  },
  cookie: {
    title: "Cookie Policy",
    body: "We use strictly necessary cookies to keep you signed in. Any analytics or marketing cookies are off by default and only load after you explicitly opt in. Questions: info@sarafoundationafrica.com."
  }
};

// "How it works" — describes the real onboarding -> learning -> growth loop
// already built (OnboardingPage's tracks/level questionnaire, sequential
// lesson unlocking with the embedded AI tutor/quizzes, then mentorship,
// community, and gamification layered on top), not aspirational steps.
const HOW_IT_WORKS = [
  {
    icon: UserPlus,
    title: "Tell us your goals",
    desc: "Pick your track and current level during a short onboarding questionnaire so your learning path and AI tutor start relevant from lesson one."
  },
  {
    icon: BookOpen,
    title: "Learn, lesson by lesson",
    desc: "Work through a sequential path (each lesson unlocks after the last), asking the embedded AI tutor for hints and taking AI-generated quizzes to check what's sticking."
  },
  {
    icon: Rocket,
    title: "Get support & keep momentum",
    desc: "Book 1:1 mentor sessions, join the community and study groups, and earn XP, streaks, and badges as you go."
  }
];

// Feature grid — deliberately limited to capabilities that actually exist in
// the shipped product today (verified against the real screens/components
// before writing this copy), described plainly rather than aspirationally.
const FEATURES = [
  {
    icon: Brain,
    color: "#6D28D9",
    bg: "rgba(109,40,217,.1)",
    title: "AI Quiz Assistant",
    desc: "Take AI-generated practice quizzes on any topic, get instant scoring and XP, and see topic-level mastery insights that flag which skills need more work."
  },
  {
    icon: Trophy,
    color: "#F5A524",
    bg: "rgba(245,165,36,.1)",
    title: "Gamification & Achievements",
    desc: "Earn XP and level up as you complete lessons, build day-streaks (with streak freezes to protect your progress), and unlock badges across mastery, consistency, and completion categories."
  },
  {
    icon: GraduationCap,
    color: "#17A673",
    bg: "rgba(23,166,115,.1)",
    title: "1-on-1 Mentorship",
    desc: "Browse vetted mentors, book a session against their real weekly availability, and bring a stated goal for the call — sessions show up in your upcoming schedule."
  },
  {
    icon: MessageSquare,
    color: "#2563EB",
    bg: "rgba(37,99,235,.1)",
    title: "Community & Study Groups",
    desc: "Post to a community feed, join topic-based study groups with their own live group chat, follow other learners, and see trending discussion tags."
  },
  {
    icon: Layers,
    color: "#DB2777",
    bg: "rgba(219,39,119,.1)",
    title: "Cohorts for Organizations",
    desc: "Organizations running Train AI for a team can group learners into cohorts and track member count and aggregate completion progress in one place."
  },
  {
    icon: ShieldCheck,
    color: "#656C86",
    bg: "rgba(101,108,134,.1)",
    title: "GDPR & Enterprise Compliance",
    desc: "Append-only audit logging, DSAR data export, consent mode controls, and multi-tenant organization isolation built in from the start."
  }
];

// Clearly-labeled illustrative placeholder testimonials — there is no real
// testimonials table backing this yet, so no invented names/photos are used,
// only generic, honest attributions.
const TESTIMONIALS = [
  {
    quote: "The AI tutor catching my mistakes mid-lesson, instead of after a quiz, changed how fast I actually learn.",
    attribution: "Early user, Data & AI track"
  },
  {
    quote: "Booking a mentor session felt as easy as booking a calendar slot — no back-and-forth emails.",
    attribution: "Beta tester, Mentorship program"
  },
  {
    quote: "Streaks and badges sound gimmicky until you realize they're the reason you opened the app on a busy day.",
    attribution: "Early user, Product team"
  }
];

const FAQ_ITEMS = [
  {
    q: "What is Train AI?",
    a: "Train AI is an AI & tech skills learning platform built by Sara Foundation Africa. It combines structured, self-paced learning paths, an embedded AI tutor and quiz assistant, 1:1 mentorship, and community features in one place."
  },
  {
    q: "Is Train AI free to join?",
    a: "You can join the free waitlist to reserve your spot with no payment required. We also offer a paid \"skip the line\" option for learners who want early access, premium AI features, and a 1-on-1 onboarding session sooner."
  },
  {
    q: "What can I actually learn on the platform?",
    a: "Learning paths currently span Data & AI, Software Engineering, and Product Design, structured so each lesson unlocks only after you complete the one before it."
  },
  {
    q: "How does mentorship work?",
    a: "You browse mentor profiles (with ratings and rates), pick an open slot from their real weekly availability, state your goal for the session, and it's confirmed straight into your schedule."
  },
  {
    q: "Is my data private?",
    a: "Yes. We only collect what's needed to run your account and progress, never sell personal data, and support data export/deletion requests and cookie consent controls — see our Privacy Policy for details."
  },
  {
    q: "Can my organization run Train AI for a team?",
    a: "Yes — organizations can invite members, group them into cohorts, and track each cohort's size and aggregate completion progress from an admin view."
  }
];

export default function LandingPage({ onNavigate }) {
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistTier, setWaitlistTier] = useState(WAITLIST_TIERS.FREE); // "free" | "paid" — two-tier waitlist growth feature
  const [joinedWaitlist, setJoinedWaitlist] = useState(false);
  const [waitlistError, setWaitlistError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // "about" | "privacy" | "terms" | "cookie" | null
  const [openFaq, setOpenFaq] = useState(0); // index of open FAQ accordion item, or null

  async function handleWaitlistSubmit(e) {
    e.preventDefault();
    if (!waitlistEmail.trim() || submitting) return;
    setSubmitting(true);
    setWaitlistError("");
    try {
      // Free tier writes straight to the plain `waitlist` table (unchanged
      // behaviour). Paid tier redirects the browser to a real Paystack
      // checkout (context "waitlist_premium") — the deployed edge function
      // records the paid_waitlist row itself once checkout starts.
      const result = await joinWaitlist({
        email: waitlistEmail.trim(),
        tier: waitlistTier === WAITLIST_TIERS.PAID ? WAITLIST_TIERS.PAID : undefined,
        source: "landing_page",
        currency: "NGN",
      });
      if (!result.success) {
        setWaitlistError(result.error || "Could not join the waitlist. Please try again.");
        return;
      }
      if (result.redirecting) return; // browser is navigating to hosted checkout
      setJoinedWaitlist(true);
    } catch (err) {
      console.warn("Waitlist signup failed:", err);
      setWaitlistError("Something went wrong — please try again, or email info@sarafoundationafrica.com.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleNav(target) {
    if (["about", "privacy", "terms", "cookie"].includes(target)) {
      setActiveModal(target);
      return;
    }
    onNavigate(target);
  }

  return (
    <div style={styles.outer}>
      <style>{`
        @keyframes heroPop { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
        .hero-anim { animation: heroPop .4s ease both; }
        .action-btn:hover { transform: translateY(-1px); box-shadow: 0 12px 24px -6px rgba(37,99,235,.5); }
      `}</style>

      {/* Header Navigation */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.brandRow}>
            <img src="/brand/train-ai-logo.png" alt="Train AI" style={{ width: 34, height: 34, objectFit: "contain", borderRadius: 0, flexShrink: 0 }} />
            <div>
              <div style={styles.brandName}>Train AI</div>
              <div style={styles.brandSub}>Sara Foundation Africa</div>
            </div>
          </div>

          <nav style={styles.navLinks}>
            <span style={styles.navLink} onClick={() => handleNav("courses")}>Courses</span>
            <span style={styles.navLink} onClick={() => handleNav("mentors")}>Mentors</span>
            <span style={styles.navLink} onClick={() => handleNav("about")}>About Us</span>
          </nav>

          <div style={{ display: "flex", gap: 10 }}>
            <button style={styles.signInBtn} onClick={() => handleNav("signin")}>Sign In</button>
            <button className="action-btn" style={styles.getStartedBtn} onClick={() => handleNav("signup")}>Get Started</button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main style={styles.heroSection} className="hero-anim">
        <div style={styles.heroTag}><Heart size={13} color="#2563EB" /> Empowering AI &amp; Tech Leadership in Africa</div>
        <h1 style={styles.heroH1}>Master In-Demand AI &amp; Tech Skills with 1:1 Mentorship</h1>
        <p style={styles.heroSub}>
          Self-paced learning paths, real-time AI tutors, sequential lesson progression, and direct mentorship built for ambitious learners across Africa.
        </p>

        {/* Feature Cards Grid (quick highlights) */}
        <div style={styles.grid}>
          <div style={styles.card}>
            <div style={{ ...styles.cardIcon, background: "rgba(37,99,235,.1)" }}><BookOpen size={20} color="#2563EB" /></div>
            <h3 style={styles.cardTitle}>Structured Learning Paths</h3>
            <p style={styles.cardDesc}>Sequential lesson progression ($N+1$ unlocks only after $N$ completion) across Data &amp; AI, Software Engineering, and Product Design.</p>
          </div>

          <div style={styles.card}>
            <div style={{ ...styles.cardIcon, background: "rgba(23,166,115,.1)" }}><GraduationCap size={20} color="#17A673" /></div>
            <h3 style={styles.cardTitle}>1-on-1 Mentorship</h3>
            <p style={styles.cardDesc}>Book live 1:1 sessions with verified industry leaders. Video calls, private notes, and feedback integrated directly into your schedule.</p>
          </div>

          <div style={styles.card}>
            <div style={{ ...styles.cardIcon, background: "rgba(109,141,255,.1)" }}><Cpu size={20} color="#60A5FA" /></div>
            <h3 style={styles.cardTitle}>Embedded AI Assistant</h3>
            <p style={styles.cardDesc}>Contextual AI tutor inside every lesson, offering instant explanations, code hints, and AI-generated end-of-lesson quizzes.</p>
          </div>

          <div style={styles.card}>
            <div style={{ ...styles.cardIcon, background: "rgba(245,165,36,.1)" }}><ShieldCheck size={20} color="#F5A524" /></div>
            <h3 style={styles.cardTitle}>GDPR &amp; Enterprise Compliance</h3>
            <p style={styles.cardDesc}>Append-only audit logging, DSAR data export, consent mode controls, and multi-tenant organization isolation.</p>
          </div>
        </div>
      </main>

      {/* How It Works */}
      <section style={styles.section}>
        <div style={styles.sectionInner}>
          <div style={styles.sectionTag}><ClipboardList size={13} color="#2563EB" /> How it works</div>
          <h2 style={styles.sectionH2}>From sign-up to your first skill, in three steps</h2>
          <p style={styles.sectionSub}>No confusing setup — here's exactly what happens when you join.</p>

          <div style={styles.stepsRow}>
            {HOW_IT_WORKS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.title} style={styles.stepCard}>
                  <div style={styles.stepNumber}>{i + 1}</div>
                  <div style={styles.stepIcon}><Icon size={20} color="#2563EB" /></div>
                  <h3 style={styles.cardTitle}>{step.title}</h3>
                  <p style={styles.cardDesc}>{step.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Benefits / Features Grid */}
      <section style={{ ...styles.section, background: "#fff" }}>
        <div style={styles.sectionInner}>
          <div style={styles.sectionTag}><Zap size={13} color="#2563EB" /> What's inside</div>
          <h2 style={styles.sectionH2}>Everything built to help you actually finish what you start</h2>
          <p style={styles.sectionSub}>Real features shipped in the product today — not a roadmap.</p>

          <div style={styles.featuresGrid}>
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} style={styles.card}>
                  <div style={{ ...styles.cardIcon, background: f.bg }}><Icon size={20} color={f.color} /></div>
                  <h3 style={styles.cardTitle}>{f.title}</h3>
                  <p style={styles.cardDesc}>{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Testimonials — clearly-labeled illustrative placeholders */}
      <section style={styles.section}>
        <div style={styles.sectionInner}>
          <div style={styles.sectionTag}><Quote size={13} color="#2563EB" /> What people say</div>
          <h2 style={styles.sectionH2}>Illustrative feedback from our closed beta</h2>
          <p style={styles.sectionSub}>
            Train AI doesn't have a public testimonials program yet, so these are illustrative examples of the kind
            of feedback we're hearing, not verified quotes from named individuals.
          </p>

          <div style={styles.testimonialGrid}>
            {TESTIMONIALS.map((t) => (
              <div key={t.quote} style={styles.testimonialCard}>
                <Quote size={18} color="#C7D2FE" />
                <p style={styles.testimonialQuote}>&ldquo;{t.quote}&rdquo;</p>
                <div style={styles.testimonialAttribution}>{t.attribution}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ ...styles.section, background: "#fff" }}>
        <div style={{ ...styles.sectionInner, maxWidth: 720 }}>
          <div style={styles.sectionTag}><HelpCircle size={13} color="#2563EB" /> FAQ</div>
          <h2 style={styles.sectionH2}>Frequently asked questions</h2>

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
                    {isOpen ? <ChevronUp size={18} color="#656C86" /> : <ChevronDown size={18} color="#656C86" />}
                  </button>
                  {isOpen && <p style={styles.faqAnswer}>{item.a}</p>}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Final CTA — two-tier waitlist (unchanged logic from prior pass) */}
      <section style={styles.ctaSection}>
        <div style={styles.sectionInner}>
          <h2 style={{ ...styles.sectionH2, color: "#fff" }}>Ready to start learning smarter?</h2>
          <p style={{ ...styles.sectionSub, color: "rgba(255,255,255,.75)" }}>
            Join the waitlist for early access, or skip the line with premium onboarding.
          </p>

          <div style={styles.waitlistCard}>
            {joinedWaitlist ? (
              <div style={styles.successBox}>
                <CheckCircle2 size={20} color="#17A673" />
                <span>{waitlistTier === WAITLIST_TIERS.PAID ? "You're on the premium waitlist!" : "You're on the waitlist! We'll notify you as new cohorts open."}</span>
              </div>
            ) : (
              <>
                <div style={styles.tierToggleRow}>
                  <button
                    type="button"
                    onClick={() => { setWaitlistTier(WAITLIST_TIERS.FREE); setWaitlistError(""); }}
                    style={{ ...styles.tierTab, ...(waitlistTier === WAITLIST_TIERS.FREE ? styles.tierTabActive : {}) }}
                  >
                    Free waitlist
                  </button>
                  <button
                    type="button"
                    onClick={() => { setWaitlistTier(WAITLIST_TIERS.PAID); setWaitlistError(""); }}
                    style={{ ...styles.tierTab, ...(waitlistTier === WAITLIST_TIERS.PAID ? styles.tierTabActive : {}) }}
                  >
                    <Crown size={12} /> Skip the line
                  </button>
                </div>
                <form onSubmit={handleWaitlistSubmit} style={styles.waitlistForm}>
                  <input
                    type="email" required
                    placeholder={waitlistTier === WAITLIST_TIERS.PAID ? "Email for premium early access" : "Enter your email for free early access"}
                    value={waitlistEmail} onChange={(e) => setWaitlistEmail(e.target.value)}
                    style={styles.waitlistInput}
                  />
                  <button type="submit" disabled={submitting} className="action-btn" style={{ ...styles.waitlistBtn, opacity: submitting ? 0.75 : 1 }}>
                    {submitting ? "Please wait..." : waitlistTier === WAITLIST_TIERS.PAID ? "Pay ₦10,000 & Skip the Line" : "Join Waitlist"} <ArrowRight size={16} />
                  </button>
                </form>
                {waitlistTier === WAITLIST_TIERS.PAID && (
                  <div style={styles.premiumNote}>Early access, premium AI features &amp; a 1-on-1 onboarding session. Redirects to a secure Paystack checkout.</div>
                )}
                {waitlistError && <div style={styles.waitlistErrorText}>{waitlistError}</div>}
              </>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={styles.footer}>
        <div style={styles.footerInner}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: "#10142A" }}>Train AI — Sara Foundation Africa</div>
            <div style={{ fontSize: 12, color: "#656C86", marginTop: 4 }}>UK-Registered AI Skills Platform</div>
          </div>
          <div style={{ display: "flex", gap: 16, fontSize: 12.5, color: "#656C86" }}>
            <span style={{ cursor: "pointer" }} onClick={() => handleNav("privacy")}>Privacy Policy</span>
            <span style={{ cursor: "pointer" }} onClick={() => handleNav("terms")}>Terms of Service</span>
            <span style={{ cursor: "pointer" }} onClick={() => handleNav("cookie")}>Cookie Policy</span>
          </div>
        </div>
      </footer>

      {activeModal && (
        <div style={styles.modalOverlay} onClick={() => setActiveModal(null)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>{LEGAL_CONTENT[activeModal].title}</h3>
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
  header: { background: "#fff", borderBottom: "1px solid #E6E9F5", sticky: "top", position: "sticky", top: 0, zIndex: 50 },
  headerInner: { maxWidth: 1100, margin: "0 auto", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" },
  brandRow: { display: "flex", alignItems: "center", gap: 10 },
  brandMark: { width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg, #1D4ED8, #60A5FA)", display: "flex", alignItems: "center", justifyContent: "center" },
  brandName: { fontWeight: 800, fontSize: 16, color: "#10142A", lineHeight: 1.1 },
  brandSub: { fontSize: 10.5, fontWeight: 700, color: "#2563EB", textTransform: "uppercase", letterSpacing: ".06em" },
  navLinks: { display: "flex", gap: 24 },
  navLink: { fontSize: 13.5, fontWeight: 600, color: "#656C86", cursor: "pointer" },
  signInBtn: { border: "1.5px solid #E6E9F5", background: "transparent", padding: "8px 16px", borderRadius: 11, fontWeight: 700, fontSize: 13, cursor: "pointer" },
  getStartedBtn: { border: "none", background: "linear-gradient(135deg, #1D4ED8, #60A5FA)", color: "#fff", padding: "9px 18px", borderRadius: 11, fontWeight: 700, fontSize: 13, cursor: "pointer" },
  heroSection: { maxWidth: 900, margin: "0 auto", padding: "60px 20px 80px", textAlign: "center" },
  heroTag: { display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 14px", borderRadius: 99, background: "#EEF2FF", color: "#2563EB", fontSize: 12, fontWeight: 700, marginBottom: 20 },
  heroH1: { fontSize: 38, fontWeight: 900, letterSpacing: "-0.03em", color: "#10142A", margin: "0 0 16px", lineHeight: 1.15 },
  heroSub: { fontSize: 16, color: "#656C86", maxWidth: 680, margin: "0 auto 36px", lineHeight: 1.5 },
  waitlistCard: { maxWidth: 520, margin: "0 auto", background: "#fff", padding: 8, borderRadius: 16, border: "1px solid #E6E9F5", boxShadow: "0 20px 40px -16px rgba(16,20,42,.12)" },
  tierToggleRow: { display: "flex", gap: 6, padding: "6px 6px 2px" },
  tierTab: {
    flex: 1, border: "1.5px solid transparent", background: "#F4F6FC", color: "#656C86", padding: "8px 10px",
    borderRadius: 10, fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center",
    justifyContent: "center", gap: 5, transition: "background-color .12s ease, color .12s ease",
  },
  tierTabActive: { background: "#EEF2FF", color: "#2563EB", border: "1.5px solid #2563EB" },
  waitlistForm: { display: "flex", gap: 8, padding: "6px 6px 6px" },
  waitlistInput: { flex: 1, border: "none", padding: "12px 16px", fontSize: 13.5, borderRadius: 11, outline: "none" },
  waitlistBtn: { border: "none", background: "linear-gradient(135deg, #1D4ED8, #60A5FA)", color: "#fff", padding: "12px 20px", borderRadius: 11, fontWeight: 700, fontSize: 13.5, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" },
  premiumNote: { padding: "0 12px 10px", fontSize: 11, color: "#9AA1B9", lineHeight: 1.4, textAlign: "left" },
  waitlistErrorText: { padding: "0 12px 10px", fontSize: 12, color: "#EF4444", fontWeight: 600, textAlign: "left" },
  successBox: { display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", fontSize: 13.5, fontWeight: 600, color: "#17A673" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20, textAlign: "left" },
  card: { background: "#fff", padding: 22, borderRadius: 18, border: "1px solid #E6E9F5" },
  cardIcon: { width: 42, height: 42, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 },
  cardTitle: { fontSize: 15, fontWeight: 800, margin: "0 0 6px", color: "#10142A" },
  cardDesc: { fontSize: 12.5, color: "#656C86", margin: 0, lineHeight: 1.45 },

  // Shared section scaffolding for the new marketing sections
  section: { padding: "72px 20px" },
  sectionInner: { maxWidth: 1100, margin: "0 auto", textAlign: "center" },
  sectionTag: { display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 14px", borderRadius: 99, background: "#EEF2FF", color: "#2563EB", fontSize: 12, fontWeight: 700, marginBottom: 16 },
  sectionH2: { fontSize: 28, fontWeight: 900, letterSpacing: "-0.02em", color: "#10142A", margin: "0 0 10px", lineHeight: 1.2 },
  sectionSub: { fontSize: 14.5, color: "#656C86", maxWidth: 560, margin: "0 auto 40px", lineHeight: 1.55 },

  // How it works
  stepsRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20, textAlign: "left" },
  stepCard: { position: "relative", background: "#fff", padding: "26px 22px 22px", borderRadius: 18, border: "1px solid #E6E9F5" },
  stepNumber: { position: "absolute", top: 16, right: 18, fontSize: 12, fontWeight: 800, color: "#C7D2FE" },
  stepIcon: { width: 42, height: 42, borderRadius: 12, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 },

  // Features grid (6 cards)
  featuresGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20, textAlign: "left" },

  // Testimonials
  testimonialGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20, textAlign: "left" },
  testimonialCard: { background: "#fff", padding: 22, borderRadius: 18, border: "1px solid #E6E9F5", display: "flex", flexDirection: "column", gap: 12 },
  testimonialQuote: { fontSize: 13.5, color: "#10142A", lineHeight: 1.55, margin: 0, fontStyle: "italic" },
  testimonialAttribution: { fontSize: 12, fontWeight: 700, color: "#9AA1B9" },

  // FAQ accordion
  faqList: { display: "flex", flexDirection: "column", gap: 10, textAlign: "left" },
  faqItem: { background: "#F4F6FC", border: "1px solid #E6E9F5", borderRadius: 14, padding: "4px 18px" },
  faqQuestion: {
    width: "100%", border: "none", background: "transparent", cursor: "pointer", padding: "14px 0",
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
    fontSize: 14, fontWeight: 700, color: "#10142A", textAlign: "left"
  },
  faqAnswer: { margin: "0 0 16px", fontSize: 13, color: "#656C86", lineHeight: 1.55 },

  // Final CTA section (dark, hosts the waitlist card)
  ctaSection: { padding: "72px 20px", background: "linear-gradient(135deg, #10142A, #1D4ED8)" },

  footer: { borderTop: "1px solid #E6E9F5", background: "#fff", padding: "24px 20px" },
  footerInner: { maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(16,20,42,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 100 },
  modalCard: { background: "#fff", borderRadius: 18, padding: 24, maxWidth: 460, width: "100%", boxShadow: "0 30px 60px -24px rgba(16,20,42,.35)" },
  modalHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  modalTitle: { fontSize: 17, fontWeight: 800, color: "#10142A", margin: 0 },
  modalClose: { border: "none", background: "#F4F6FC", borderRadius: 8, padding: 6, cursor: "pointer", display: "flex" },
  modalBody: { fontSize: 13.5, color: "#656C86", lineHeight: 1.55, margin: 0 }
};
