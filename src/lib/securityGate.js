// An unavailable security check must never be interpreted as successful MFA.
export async function resolveMfaGate(check, timeoutMs = 15000) {
  let timer;
  try {
    const levels = await Promise.race([
      Promise.resolve().then(check),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Security verification timed out. Please retry.")), timeoutMs); }),
    ]);
    if (!["aal1", "aal2"].includes(levels?.currentLevel) || !["aal1", "aal2"].includes(levels?.nextLevel)) {
      throw new Error("Could not verify your account security. Please retry.");
    }
    return levels.currentLevel !== "aal2" && levels.nextLevel === "aal2" ? "required" : "clear";
  } finally { clearTimeout(timer); }
}
