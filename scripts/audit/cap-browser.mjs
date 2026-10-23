import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(
  path.join(
    process.env.TEMP,
    "trainai-learner-visual/node_modules/playwright-core",
  ),
);
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const out = "docs/audit/cap-workspace";
fs.mkdirSync(out, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/*", (r) =>
    new URL(r.request().url()).hostname === "127.0.0.1"
      ? r.continue()
      : r.abort(),
  );
  await page.goto("http://127.0.0.1:5188/?fixture_cap_test&fixture_profile_goal");
  await page.getByText("My learning goal",{exact:true}).click();
  await page.getByLabel("Learning goal track",{exact:true}).fill("Code");
  await page.getByLabel("Learning goal specific skill",{exact:true}).fill("Frontend development");
  await page.getByRole("button",{name:"Save my learning goal",exact:true}).click();
  await page.getByText(/Learning goal saved. Your administrator/).waitFor();
  await page.reload();await page.getByText("My learning goal · Code → Frontend development",{exact:true}).waitFor();
  await page.goto("http://127.0.0.1:5188/?fixture_cap_test");
  await page.getByLabel("Track", { exact: true }).selectOption("Code");
  await page
    .getByLabel("Specific skill", { exact: true })
    .selectOption("Frontend development");
  await page
    .getByRole("button", { name: "Save learning goal", exact: true })
    .click();
  await page.getByText("Saved choice:", { exact: true }).waitFor();
  assert.ok(
    (await page.locator("body").innerText()).includes(
      "Code → Frontend development",
    ),
  );
  await page
    .getByLabel("Problem title", { exact: true })
    .fill("Actual problem");
  await page
    .getByLabel("Problem statement", { exact: true })
    .fill("A real problem to solve");
  await page
    .getByRole("button", { name: "Submit problem statement", exact: true })
    .click();
  await page.getByText("Status: Submitted", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Build & teams", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Register team & project", exact: true })
    .click();
  await page.getByLabel("Team name", { exact: true }).fill("Saved team");
  await page.getByLabel("Project title", { exact: true }).fill("Saved project");
  await page
    .getByLabel("Your team role", { exact: true })
    .fill("Frontend developer");
  await page
    .getByRole("button", { name: "Register & join team", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Saved team", exact: true })
    .waitFor();
  assert.ok(!(await page.locator("body").innerText()).includes("Nexus AI"));
  assert.equal(
    await page
      .getByRole("button", { name: "Archive team", exact: true })
      .count(),
    0,
  );
  await page.goto("http://127.0.0.1:5188/?fixture_cap_test&cap_role=admin");
  await page.getByText(/View learner goals & problem statements/).click();
  await page
    .getByRole("heading", {
      name: "Learner goals & problem statements",
      exact: true,
    })
    .waitFor();
  assert.ok(
    (await page.locator("body").innerText()).includes(
      "Code → Frontend development",
    ),
  );
  await page
    .getByText("Problem statement · Submitted", { exact: true })
    .click();
  await page
    .getByLabel("Review feedback", { exact: true })
    .fill("Real review feedback");
  await page.getByRole("button", { name: "Save review", exact: true }).click();
  await page
    .getByText("Problem statement · Reviewed", { exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Build & teams", exact: true })
    .click();
  await page.getByRole("button", { name: "Edit project", exact: true }).click();
  await page.getByLabel("Team phase", { exact: true }).selectOption("LAUNCH");
  await page
    .getByLabel("Assigned mentor", { exact: true })
    .selectOption("mentor");
  await page
    .getByLabel("Final score (0–100, blank if unscored)", { exact: true })
    .fill("100");
  await page.getByRole("button", { name: "Save team", exact: true }).click();
  await page.getByText("Log mentorship check-in", { exact: true }).click();
  await page.getByLabel("Team", { exact: true }).selectOption("saved-team");
  await page
    .getByLabel("Progress notes", { exact: true })
    .fill("Real check-in notes");
  await page
    .getByRole("button", { name: "Save check-in", exact: true })
    .click();
  await page.getByText("Real check-in notes", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Demo Day", exact: true }).click();
  await page.getByText("Final score: 100/100", { exact: true }).waitFor();
  for (const width of [320, 390, 540, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "Overflow at " + width,
    );
    await page.screenshot({
      path: `${out}/admin-${width}.png`,
      fullPage: true,
    });
  }
  await page
    .getByRole("button", { name: "Build & teams", exact: true })
    .click();
  await page.getByRole("button", { name: "Edit project", exact: true }).click();
  await page.evaluate(() => {
    window.__capFailSave = true;
  });
  await page.getByRole("button", { name: "Save team", exact: true }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Saved record could not be updated" })
    .waitFor();
  await page.evaluate(() => {
    window.__capFailLoad = true;
  });
  await page.reload();
  await page
    .getByRole("heading", { name: "CAP Cohort 3", exact: true })
    .waitFor();
  // Failures on initial load remain retryable and never show sample records.
  const failed = await browser.newPage();
  await failed.addInitScript(() => {
    window.__capFailLoad = true;
  });
  await failed.goto("http://127.0.0.1:5188/?fixture_cap_test");
  await failed
    .getByRole("button", { name: "Retry CAP workspace", exact: true })
    .waitFor();
  await failed.evaluate(() => {
    window.__capFailLoad = false;
  });
  await failed
    .getByRole("button", { name: "Retry CAP workspace", exact: true })
    .click();
  await failed.getByLabel("Track", { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: CAP learning goal, persistent submission, admin review, team controls, check-ins, 100/100 score, retry and mobile layouts",
  );
} finally {
  await browser.close();
}
