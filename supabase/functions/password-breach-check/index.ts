const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const prefix = String(body.hash_prefix || "").trim().toUpperCase();
    const suffix = String(body.hash_suffix || "").trim().toUpperCase();
    if (!/^[A-F0-9]{5}$/.test(prefix) || !/^[A-F0-9]{35}$/.test(suffix)) {
      return json({ error: "A valid SHA-1 hash prefix and suffix are required." }, 400);
    }

    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: {
        "Add-Padding": "true",
        "User-Agent": "TrainAI-Password-Safety/1.0",
      },
    });
    if (!response.ok) {
      console.warn("Pwned Passwords lookup failed", response.status);
      return json({ breached: false, count: 0, degraded: true });
    }

    const match = (await response.text())
      .split(/\r?\n/)
      .map((line) => line.split(":"))
      .find(([candidate]) => candidate === suffix);
    const count = match ? Number(match[1] || 0) : 0;
    return json({ breached: count > 0, count, degraded: false });
  } catch (error) {
    console.error("password-breach-check failed", error);
    return json({ breached: false, count: 0, degraded: true });
  }
});
