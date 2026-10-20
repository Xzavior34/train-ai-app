// Public entry points are shared by first load and browser back/forward.
// OAuth's `code` parameter belongs to Auth and is never a certificate code.
export function parsePublicLocation(location) {
  const params = new URLSearchParams(location.search || "");
  const path = (location.pathname || "/").replace(/\/+$/, "") || "/";
  let certCode = params.get("verify") || params.get("cert") || params.get("certificate");
  const certificatePath = path.match(/^\/(?:verify|certificate)(?:\/(.*))?$/);
  if (!certCode && certificatePath) {
    try { certCode = decodeURIComponent(certificatePath[1] || "1"); }
    catch { certCode = certificatePath[1] || "1"; }
  }
  const orgTarget = params.get("join") || params.get("org") || params.get("workspace") || params.get("ref_org");
  let view = "landing";
  if (params.get("view") === "book-demo" || params.get("demo") === "true" || params.get("book") === "demo") view = "book-demo";
  else if (params.get("view") === "marketplace" || path === "/marketplace") view = "marketplace";
  else if (params.get("view") === "auth" || orgTarget) view = "auth";
  return { view, certCode: certCode || null, inviteToken: params.get("invite") || params.get("token") || params.get("invite_token") || null,
    authMode: ["signin", "signup"].includes(params.get("mode")) ? params.get("mode") : orgTarget ? "signup" : "", orgTarget };
}
