import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");
const template = await readFile(path.join(dist, "index.html"), "utf8");
const siteUrl = "https://trainailtd.com";

const pages = [
  {
    route: "about",
    title: "About Train AI | Learning Operations & Workforce Intelligence",
    description: "Learn how Train AI helps academies, foundations and businesses deliver structured learning, manage cohorts and understand development outcomes.",
    heading: "Learning operations and workforce intelligence in one platform",
    summary: "Train AI connects course delivery, cohorts, learning communities, learner support and development intelligence in one managed environment.",
  },
  {
    route: "book-demo",
    title: "Book a Train AI Demo | Organisational Learning Platform",
    description: "Book a personalised Train AI demo for your academy, foundation or business and review course delivery, cohort management and workforce insights.",
    heading: "Book a personalised Train AI demo",
    summary: "Review your learning model, cohort structure, learner support and reporting needs with the Train AI team.",
  },
  {
    route: "marketplace",
    title: "Training Course Marketplace | Train AI",
    description: "Explore published learning programmes from training providers using the Train AI course marketplace.",
    heading: "Explore training courses on Train AI",
    summary: "Discover published learning programmes from academies and training providers using the Train AI platform.",
  },
  {
    route: "contact",
    title: "Contact Train AI | Platform and Account Support",
    description: "Contact Train AI about organisational learning delivery, cohort management, workforce development or platform support.",
    heading: "Talk to the Train AI team",
    summary: "Contact Train AI about your organisation's learners, delivery model, cohort structure, reporting needs or existing platform account.",
  },
  {
    route: "privacy-policy",
    title: "Privacy Policy | Train AI",
    description: "Read how Train AI handles organisational, account and learning data used to provide secure learning, administration and reporting services.",
    heading: "Train AI privacy information",
    summary: "Learn how Train AI uses and protects account, organisation and learning information required to operate the platform.",
  },
  {
    route: "terms-of-service",
    title: "Terms of Service | Train AI",
    description: "Read the service terms that apply to use of the Train AI learning and development platform.",
    heading: "Train AI terms of service",
    summary: "Review the account, authorised access, acceptable use and service terms that apply to the Train AI platform.",
  },
];

function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

for (const page of pages) {
  const url = `${siteUrl}/${page.route}`;
  let html = template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(page.title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*("\s*\/?>)/, `$1${escapeHtml(page.description)}$2`)
    .replace(/(<link rel="canonical" href=")[^"]*("\s*\/?>)/, `$1${url}$2`)
    .replace(/(<link rel="alternate" hreflang="en" href=")[^"]*("\s*\/?>)/, `$1${url}$2`)
    .replace(/(<link rel="alternate" hreflang="x-default" href=")[^"]*("\s*\/?>)/, `$1${url}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*("\s*\/?>)/, `$1${url}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*("\s*\/?>)/, `$1${escapeHtml(page.title)}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*("\s*\/?>)/, `$1${escapeHtml(page.description)}$2`)
    .replace(/(<meta name="twitter:url" content=")[^"]*("\s*\/?>)/, `$1${url}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*("\s*\/?>)/, `$1${escapeHtml(page.title)}$2`)
    .replace(/(<meta name="twitter:description" content=")[^"]*("\s*\/?>)/, `$1${escapeHtml(page.description)}$2`)
    .replace(
      /<noscript>[\s\S]*?<\/noscript>/,
      `<noscript><main style="max-width:760px;margin:48px auto;padding:0 24px;font-family:Arial,sans-serif;color:#172033;line-height:1.65"><h1>${escapeHtml(page.heading)}</h1><p>${escapeHtml(page.summary)}</p><p><a href="/">Train AI home</a> · <a href="/about">About</a> · <a href="/book-demo">Book a demo</a> · <a href="/contact">Contact</a></p></main></noscript>`,
    );

  const destination = path.join(dist, page.route);
  await mkdir(destination, { recursive: true });
  await writeFile(path.join(destination, "index.html"), html, "utf8");
}
