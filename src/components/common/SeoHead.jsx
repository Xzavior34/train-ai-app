import { useEffect } from "react";

const SITE_URL = "https://trainailtd.com";
const DEFAULT_IMAGE = `${SITE_URL}/images/train-ai-diverse-learners.jpg`;

function setMeta(selector, attributes) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement("meta");
    document.head.appendChild(element);
  }
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
}

function setLink(rel, href, extra = {}) {
  let element = document.head.querySelector(`link[rel="${rel}"]${extra.hreflang ? `[hreflang="${extra.hreflang}"]` : ""}`);
  if (!element) {
    element = document.createElement("link");
    element.rel = rel;
    document.head.appendChild(element);
  }
  element.href = href;
  Object.entries(extra).forEach(([name, value]) => element.setAttribute(name, value));
}

export default function SeoHead({
  title,
  description,
  path = "/",
  robots = "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
  type = "website",
  image = DEFAULT_IMAGE,
  schema = [],
}) {
  useEffect(() => {
    const canonical = `${SITE_URL}${path === "/" ? "/" : path}`;
    document.title = title;
    document.documentElement.lang = "en-GB";
    setMeta('meta[name="description"]', { name: "description", content: description });
    setMeta('meta[name="robots"]', { name: "robots", content: robots });
    setMeta('meta[property="og:type"]', { property: "og:type", content: type });
    setMeta('meta[property="og:url"]', { property: "og:url", content: canonical });
    setMeta('meta[property="og:title"]', { property: "og:title", content: title });
    setMeta('meta[property="og:description"]', { property: "og:description", content: description });
    setMeta('meta[property="og:image"]', { property: "og:image", content: image });
    setMeta('meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" });
    setMeta('meta[name="twitter:url"]', { name: "twitter:url", content: canonical });
    setMeta('meta[name="twitter:title"]', { name: "twitter:title", content: title });
    setMeta('meta[name="twitter:description"]', { name: "twitter:description", content: description });
    setMeta('meta[name="twitter:image"]', { name: "twitter:image", content: image });
    setLink("canonical", canonical);
    setLink("alternate", canonical, { hreflang: "en" });
    setLink("alternate", canonical, { hreflang: "x-default" });

    let jsonLd = document.head.querySelector('script[data-trainai-seo="page"]');
    if (!jsonLd) {
      jsonLd = document.createElement("script");
      jsonLd.type = "application/ld+json";
      jsonLd.dataset.trainaiSeo = "page";
      document.head.appendChild(jsonLd);
    }
    jsonLd.textContent = JSON.stringify({ "@context": "https://schema.org", "@graph": schema });
  }, [description, image, path, robots, schema, title, type]);

  return null;
}

export { SITE_URL };
