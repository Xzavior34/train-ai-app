import fs from "fs";
import path from "path";

const SRC_DIR = "src";
const DANGEROUS_PATTERNS = [
  { name: "Service Role Key in Frontend", regex: /service_role\s*[:=]\s*["']eyJ/i },
  { name: "Hardcoded Secret Key (sk_live/sk_test)", regex: /sk_(live|test)_[0-9a-zA-Z]{20,}/ },
  { name: "Hardcoded Stripe Webhook Secret (whsec_)", regex: /whsec_[0-9a-zA-Z]{20,}/ },
  { name: "Hardcoded Paystack Secret (sk_)", regex: /sk_live_[0-9a-zA-Z]+/ },
  { name: "Client-side disable RLS", regex: /alter table .* disable row level security/i },
];

function scanDir(dir, findings) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath, findings);
    } else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) {
      const content = fs.readFileSync(fullPath, "utf8");
      for (const rule of DANGEROUS_PATTERNS) {
        const matches = content.match(rule.regex);
        if (matches) {
          findings.push({
            file: fullPath,
            rule: rule.name,
            match: matches[0].slice(0, 30) + "..."
          });
        }
      }
    }
  }
}

async function run() {
  console.log("=== REPOSITORY SECURITY SWEEP (src/) ===");
  const findings = [];
  scanDir(SRC_DIR, findings);

  console.log(`Scan completed. Total files checked in ${SRC_DIR}.`);
  if (findings.length === 0) {
    console.log("PASS: No hardcoded secrets, private keys, or dangerous bypass patterns found in src/!");
  } else {
    console.warn("WARNING: Findings discovered:");
    for (const f of findings) {
      console.warn(`- [${f.rule}] in ${f.file}`);
    }
  }
}

run().catch(console.error);
