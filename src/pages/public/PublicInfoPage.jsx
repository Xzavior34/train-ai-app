import React from "react";
import { ArrowLeft, ArrowRight, Mail } from "lucide-react";
import SeoHead, { SITE_URL } from "../../components/common/SeoHead.jsx";

const PAGE_CONTENT = {
  about: {
    path: "/about",
    eyebrow: "About Train AI",
    title: "Learning operations and workforce intelligence in one platform",
    description: "Learn how Train AI helps academies, foundations and businesses deliver structured learning, manage cohorts and understand development outcomes.",
    intro: "Train AI is an AI learning and development platform for organisations. It connects course delivery, cohorts, learning communities, learner support and development intelligence in one managed environment.",
    sections: [
      ["What the platform brings together", "Organisations use Train AI to manage courses, learners, cohorts, instructors and communities while following progress, skill gaps, readiness and programme outcomes."],
      ["Who it is designed for", "The platform supports academies and training providers, foundations and social-impact organisations, and businesses that need a clearer way to deliver and measure workforce development."],
      ["How implementation works", "Train AI is configured around each organisation's learning model, team structure and reporting needs. A product demo is used to confirm the appropriate platform tier and implementation scope."],
    ],
  },
  privacy: {
    path: "/privacy-policy",
    eyebrow: "Privacy",
    title: "Train AI privacy information",
    description: "Read how Train AI handles organisational, account and learning data used to provide secure learning, administration and reporting services.",
    intro: "Train AI uses organisational and learner data to provide its learning, administration, authentication, communication and reporting services.",
    sections: [
      ["Information used by the platform", "This can include account and profile details, organisation membership, course and cohort participation, learning progress, support communications and security records required to operate the service."],
      ["How access is controlled", "Platform access is governed by authenticated roles and organisation membership. Administrative and learner information is limited to the relevant workspace and authorised users."],
      ["Privacy enquiries", "For access, correction, deletion or other privacy enquiries, contact info@trainailtd.com. Requests are reviewed against the applicable account, contractual and legal requirements."],
    ],
  },
  terms: {
    path: "/terms-of-service",
    eyebrow: "Terms",
    title: "Train AI terms of service",
    description: "Read the service terms that apply to use of the Train AI learning and development platform.",
    intro: "Use of Train AI is governed by the service agreement, platform tier and implementation scope agreed with the relevant organisation.",
    sections: [
      ["Accounts and authorised access", "Users must provide accurate account information, protect their login credentials and use only the organisation, course and cohort areas they are authorised to access."],
      ["Acceptable use", "The platform must not be used to disrupt services, access another user's information without permission, upload harmful material or violate applicable law or third-party rights."],
      ["Service and commercial enquiries", "Features, user volumes, support arrangements and commercial terms depend on the organisation's agreed plan. Contact info@trainailtd.com for contractual or service questions."],
    ],
  },
  contact: {
    path: "/contact",
    eyebrow: "Contact Train AI",
    title: "Talk to the Train AI team",
    description: "Contact Train AI about organisational learning delivery, cohort management, workforce development or platform support.",
    intro: "Speak with Train AI about your organisation's learners, delivery model, cohort structure, reporting needs or existing platform account.",
    sections: [
      ["Product and organisation enquiries", "Book a personalised product demo to review learning delivery, cohort and community management, instructor support, workforce intelligence and implementation options."],
      ["General and privacy enquiries", "Email info@trainailtd.com for general enquiries, account support, privacy requests or questions about an existing organisation workspace."],
    ],
  },
};

export default function PublicInfoPage({ page, onGoHome, onBookDemo }) {
  const content = PAGE_CONTENT[page] || PAGE_CONTENT.about;
  const schema = [
    {
      "@type": "WebPage",
      "@id": `${SITE_URL}${content.path}#webpage`,
      url: `${SITE_URL}${content.path}`,
      name: content.title,
      description: content.description,
      isPartOf: { "@id": `${SITE_URL}/#website` },
      about: { "@id": `${SITE_URL}/#organisation` },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: content.eyebrow, item: `${SITE_URL}${content.path}` },
      ],
    },
  ];

  return (
    <div className="public-info-page">
      <SeoHead title={`${content.title} | Train AI`} description={content.description} path={content.path} schema={schema} />
      <style>{styles}</style>
      <header>
        <a href="/" onClick={(event) => { event.preventDefault(); onGoHome?.(); }} aria-label="Train AI home">
          <img src="/train-ai-logo.png" alt="Train AI" width="139" height="46" />
        </a>
        <nav aria-label="Public page navigation">
          <a href="/about">About</a>
          <a href="/contact">Contact</a>
          <a href="/book-demo">Book a demo</a>
        </nav>
      </header>
      <main>
        <a className="back-link" href="/" onClick={(event) => { event.preventDefault(); onGoHome?.(); }}><ArrowLeft size={16} /> Back to Train AI</a>
        <p className="eyebrow">{content.eyebrow}</p>
        <h1>{content.title}</h1>
        <p className="intro">{content.intro}</p>
        <div className="info-sections">
          {content.sections.map(([heading, body]) => <section key={heading}><h2>{heading}</h2><p>{body}</p></section>)}
        </div>
        <aside>
          <div><Mail size={20} /><p><strong>Contact</strong><a href="mailto:info@trainailtd.com">info@trainailtd.com</a></p></div>
          <a className="demo-link" href="/book-demo" onClick={(event) => { event.preventDefault(); onBookDemo?.(); }}>Book a personalised demo <ArrowRight size={16} /></a>
        </aside>
      </main>
      <footer><span>© 2026 Train AI Ltd.</span><div><a href="/privacy-policy">Privacy</a><a href="/terms-of-service">Terms</a><a href="/contact">Contact</a></div></footer>
    </div>
  );
}

const styles = `
.public-info-page{min-height:100vh;background:#fff;color:#101828;font-family:'Plus Jakarta Sans',sans-serif}.public-info-page header{height:70px;border-bottom:1px solid #e4e9f0;display:flex;align-items:center;justify-content:space-between;padding:0 max(24px,calc((100vw - 1080px)/2))}.public-info-page header img{display:block;width:auto;height:27px}.public-info-page nav{display:flex;gap:24px;align-items:center}.public-info-page a{color:#334155;text-decoration:none;font-weight:650}.public-info-page nav a:last-child,.demo-link{color:#fff;background:#2563eb;padding:11px 17px;border-radius:5px}.public-info-page main{width:min(860px,calc(100% - 40px));margin:0 auto;padding:72px 0 84px}.back-link{display:inline-flex;align-items:center;gap:7px;margin-bottom:48px;font-size:13px}.eyebrow{margin:0 0 14px;color:#2563eb;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.13em}.public-info-page h1{max-width:760px;margin:0;font-size:clamp(38px,6vw,64px);line-height:1.03;letter-spacing:-.05em}.intro{max-width:760px;margin:26px 0 52px;color:#536174;font-size:19px;line-height:1.7}.info-sections{border-top:1px solid #dfe5ec}.info-sections section{display:grid;grid-template-columns:minmax(190px,.65fr) 1fr;gap:60px;padding:32px 0;border-bottom:1px solid #dfe5ec}.info-sections h2{margin:0;font-size:19px;letter-spacing:-.02em}.info-sections p{margin:0;color:#566477;line-height:1.75}.public-info-page aside{margin-top:52px;padding:24px;background:#f4f7fb;display:flex;align-items:center;justify-content:space-between;gap:24px}.public-info-page aside>div{display:flex;align-items:center;gap:12px}.public-info-page aside p{display:grid;gap:2px;margin:0}.public-info-page aside a:not(.demo-link){font-size:14px}.demo-link{display:inline-flex;align-items:center;gap:8px;font-size:13px}.public-info-page footer{display:flex;justify-content:space-between;gap:24px;padding:24px max(24px,calc((100vw - 1080px)/2));border-top:1px solid #e4e9f0;color:#758195;font-size:12px}.public-info-page footer div{display:flex;gap:20px}.public-info-page footer a{color:#637083;font-size:12px}@media(max-width:640px){.public-info-page header{height:60px}.public-info-page nav a:not(:last-child){display:none}.public-info-page main{padding:48px 0 60px}.back-link{margin-bottom:34px}.intro{font-size:16px;margin-bottom:38px}.info-sections section{grid-template-columns:1fr;gap:12px}.public-info-page aside{align-items:flex-start;flex-direction:column}.public-info-page footer{align-items:flex-start;flex-direction:column}}
`;
