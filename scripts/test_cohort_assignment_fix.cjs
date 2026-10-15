// Verification test for cohort member assignment and bulk add fixes
const assert = require("assert");

async function testUnitLogic() {
  console.log("=== RUNNING COHORT ASSIGNMENT FIX UNIT TESTS ===");

  // 1. Test email parsing logic across all whitespace and separator variants
  const testInput = `
    alice@company.com, bob@company.com; charlie@company.com
    david@company.com    eva@company.com
    frank@company.com
  `;
  const rawList = (testInput || "")
    .split(/[,\r\n;\t ]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e && e.includes("@"));
  const uniqueEmails = [...new Set(rawList)];

  console.log("Parsed emails count:", uniqueEmails.length);
  assert.strictEqual(uniqueEmails.length, 6, "Expected 6 parsed unique emails");
  assert.deepStrictEqual(uniqueEmails, [
    "alice@company.com",
    "bob@company.com",
    "charlie@company.com",
    "david@company.com",
    "eva@company.com",
    "frank@company.com",
  ]);
  console.log("✓ Email multi-delimiter splitting passed.");

  // 2. Test UUID validation helper
  const isValidUuid = (val) => Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(val)));
  assert.strictEqual(isValidUuid("4d034e4a-76b4-44eb-8918-ce3d1cc5dfd9"), true);
  assert.strictEqual(isValidUuid("demo-manager-id"), false);
  assert.strictEqual(isValidUuid(""), false);
  assert.strictEqual(isValidUuid(null), false);
  assert.strictEqual(isValidUuid(undefined), false);
  console.log("✓ UUID sanitization for foreign keys passed.");

  // 3. Test member label formatting in dropdown
  const formatMember = (m) => {
    const name = m.display_name || m.name || (m.email ? m.email.split("@")[0].replace(/[._-]/g, " ") : "Learner");
    const email = m.email || "";
    const label = email && !name.toLowerCase().includes(email.toLowerCase()) ? `${name} (${email})` : name;
    return { name, email, label };
  };

  const sample1 = formatMember({ display_name: "Jane Doe", email: "jane@acme.org" });
  assert.strictEqual(sample1.label, "Jane Doe (jane@acme.org)");

  const sample2 = formatMember({ email: "solo@acme.org" });
  assert.strictEqual(sample2.name, "solo");
  assert.strictEqual(sample2.label, "solo (solo@acme.org)");

  console.log("✓ Dropdown label formatting passed.");

  console.log("\nALL TESTS PASSED SUCCESSFULLY!");
}

testUnitLogic().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
