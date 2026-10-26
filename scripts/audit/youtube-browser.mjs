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
const out = "docs/audit/youtube-discovery";
fs.mkdirSync(out, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/*", (r) =>
    new URL(r.request().url()).hostname === "127.0.0.1"
      ? r.continue()
      : new URL(r.request().url()).hostname === "i.ytimg.com"
        ? r.fulfill({
            contentType: "image/svg+xml",
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360"><rect width="480" height="360" fill="#172c4c"/><text x="240" y="170" fill="white" font-size="26" text-anchor="middle">Example Academy</text><text x="240" y="210" fill="white" font-size="18" text-anchor="middle">Synthetic test course</text></svg>',
          })
        : r.abort(),
  );
  const base = "http://127.0.0.1:5188/?fixture_youtube_test";
  const search = async () => {
    await page
      .getByLabel("What should learners learn?")
      .fill("Product management for beginners");
    await page
      .getByRole("button", { name: "Find courses", exact: true })
      .click();
  };
  await page.goto(base);
  await page.getByText('Organization AI credits: 50',{exact:true}).waitFor();
  await search();
  await page.getByText('Organization AI credits: 49',{exact:true}).waitFor();
  await page.getByText("1 new suggestions saved for review.").waitFor();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `overflow ${width}`,
    );
    await page.screenshot({
      path: `${out}/review-${width}.png`,
      fullPage: true,
    });
  }
  await page.getByRole("button", { name: "Reject", exact: true }).click();
  await page.getByRole("button", { name: "Rejected (1)", exact: true }).click();
  await page.getByRole("button", { name: "Return to review" }).click();
  await page.getByRole("button", { name: "To review (1)" }).click();
  await page
    .getByRole("button", { name: "Accept course", exact: true })
    .click();
  await page.getByText(/Accepted into your course library/).waitFor();
  await page.reload();
  await page.getByRole("button", { name: "Accepted (1)", exact: true }).click();
  await page
    .getByRole("button", { name: "Assign to learners", exact: true })
    .click();
  await page.getByLabel("Example Learner", { exact: true }).check();
  await page
    .getByRole("button", { name: "Publish & assign", exact: true })
    .click();
  await page.getByText("Course published and assigned to 1 learner.").waitFor();
  await page
    .getByRole("button", { name: "Assign to learners", exact: true })
    .click();
  await page.getByLabel("Assign to", { exact: true }).selectOption("cohort");
  await page.getByLabel("Cohort", { exact: true }).selectOption("cohort");
  await page
    .getByRole("button", { name: "Publish & assign", exact: true })
    .click();
  await page.getByText("Course published and assigned to 1 learner.").waitFor();
  await page.goto(base + "&missing_key");
  await page.getByText(/YouTube search is awaiting connection/).waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Find courses", exact: true })
      .isDisabled(),
    true,
  );
  await page.goto(base + "&search_error");
  await search();
  await page
    .getByRole("alert")
    .getByText(/quota reached/)
    .waitFor();
  await page.goto(base + "&save_error");
  await search();
  await page
    .getByRole("button", { name: "Accept course", exact: true })
    .click();
  await page
    .getByRole("alert")
    .getByText(/Could not save/)
    .waitFor();
  assert.equal(
    await page.getByRole("button", { name: "To review (1)" }).isVisible(),
    true,
  );
  assert.deepEqual(errors, []);
  console.log(
    "YouTube browser workflow passed: search, responsive review, persistent approval/rejection, individual/cohort assignment, missing connection, provider/save failures.",
  );
} finally {
  await browser.close();
}
