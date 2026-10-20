// Call only after Auth has validated the token and supplied the user record.
export function hasRequiredMfa(user, verifiedJwt) {
  if (!(user?.factors || []).some(factor => factor.status === "verified")) return true;
  try {
    const encoded = verifiedJwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "="))).aal === "aal2";
  } catch { return false; }
}
