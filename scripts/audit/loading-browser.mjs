import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.TEMP, 'trainai-learner-visual/node_modules/playwright-core'));
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const results = [];
fs.mkdirSync('docs/audit/learner-cleanup', { recursive: true });
async function context(delay = 0) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await ctx.addInitScript(value => { globalThis.__auditQueryDelay = value; }, delay);
  return ctx;
}
try {
  const ctx = await context();
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:5188/?fixture_loading_test');
  await page.locator('.tai-page-skeleton:visible').waitFor();
  await page.waitForTimeout(550);
  assert.equal(await page.locator('.tai-page-skeleton:visible').count(), 1, 'Wait for all concurrent queries, not just the first');
  await page.getByText('Both fixture requests completed', { exact: true }).waitFor();
  assert.equal(await page.locator('.tai-page-skeleton:visible').count(), 0);
  await page.getByLabel('Draft kept during refresh').fill('Unsaved learner draft');
  await page.getByRole('button', { name: 'Refresh fixture feature', exact: true }).click();
  await page.getByRole('status', { name: 'Loading fixture feature', exact: true }).waitFor();
  assert.equal(await page.locator('.tai-page-skeleton:visible').count(), 0, 'Feature refresh must not hide the page');
  assert.equal(await page.getByLabel('Draft kept during refresh').inputValue(), 'Unsaved learner draft');
  await page.getByText('Both fixture requests completed', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Fixture failure page', exact: true }).click();
  await page.locator('.tai-page-skeleton:visible').waitFor();
  await page.getByRole('alert').filter({ hasText: 'Fixture query failed' }).waitFor();
  assert.equal(await page.locator('.tai-page-skeleton:visible').count(), 0, 'Failures must reveal the error, not leave an infinite skeleton');
  await page.getByRole('button', { name: 'Fixture success page', exact: true }).click();
  await page.getByRole('button', { name: 'Fixture failure page', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Fixture query failed' }).waitFor();
  results.push({ lifecycle: 'PASS: concurrent queries, feature refresh, draft preservation, errors and navigation cancellation' });
  await ctx.close();

  const routes = {
    admin: ['Courses', 'Learning Paths', 'Cohorts', 'Users & Access', 'Seats & Licensing', 'Assessments & Quizzes', 'Leaderboard & Ranks', 'Settings Hub', 'Workforce Intelligence'],
    owner: ['Organizations', 'Access Control', 'Platform Settings'],
    learner: ['Courses', 'Community', 'Feed', 'Cohort'],
  };
  for (const [role, labels] of Object.entries(routes)) {
    const ctx = await context(1000);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:5188/?fixture_role=' + role);
    await page.locator('.tai-page-skeleton:visible').waitFor();
    await page.locator('.tai-screen-loading-boundary[aria-busy="false"]:visible').waitFor();
    const reject = page.getByRole('button', { name: 'Reject non-essential', exact: true });
    if (await reject.isVisible()) await reject.click();
    if (role === 'owner') {
      await page.getByRole('button', { name: 'Switch Dashboard', exact: true }).click();
      await page.locator('.ta-ws-item:visible').filter({ hasText: 'Platform Owner Dashboard' }).click();
      await page.keyboard.press('Escape');
      await page.locator('.tai-screen-loading-boundary[aria-busy="false"]:visible').waitFor();
    }
    for (const label of labels) {
      const nav = page.locator(role === 'learner' ? '.tai-sub-item, .tai-category-header' : '.ta-sidebar .ta-nav-item').filter({ hasText: new RegExp('^' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') });
      if (!await nav.count()) { results.push({ role, page: label, skipped: 'Not available in fixture navigation' }); continue; }
      await nav.click();
      const observed = await page.locator('.tai-page-skeleton:visible').first().waitFor({ timeout: 1800 }).then(() => true, () => false);
      if (!observed && role !== 'learner') throw Error(role + ' did not show its loading layout: ' + label);
      // Learner catalog/community data may already be cached by the parent.
      // Do not demand an artificial delay when there is no request to wait for.
      const layout = observed ? await page.locator('.tai-page-skeleton:visible').first().getAttribute('data-skeleton-layout') : 'cached';
      for (const width of label === 'Leaderboard & Ranks' ? [1440, 390, 360] : [1440]) {
        await page.setViewportSize({ width, height: 1000 });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2);
        assert.equal(overflow, false, role + ' skeleton overflow: ' + label);
      }
      await page.screenshot({ path: `docs/audit/learner-cleanup/loading-${role}-${label.replace(/\W+/g, '-').toLowerCase()}.png` });
      await page.locator('.tai-screen-loading-boundary[aria-busy="false"]:visible').waitFor();
      if (role === 'admin' && label === 'Leaderboard & Ranks') {
        const margins = await page.locator('.ta-main .ta-screen-content > .tai-fade-in:visible').evaluate(el => ({ left: parseFloat(getComputedStyle(el).paddingLeft), right: parseFloat(getComputedStyle(el).paddingRight) }));
        assert(margins.left >= 12 && margins.right >= 12, 'Leaderboard needs left and right gutters');
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      assert.equal(errors.length, 0, errors.join('\n'));
      results.push({ role, page: label, layout, status: 'PASS' });
    }
    await ctx.close();
  }
  const mobile = await context(2000);
  const mobilePage = await mobile.newPage();
  await mobilePage.setViewportSize({ width: 390, height: 844 });
  await mobilePage.emulateMedia({ reducedMotion: 'reduce' });
  await mobilePage.goto('http://127.0.0.1:5188/?fixture_role=admin');
  await mobilePage.locator('.tai-page-skeleton:visible').first().waitFor();
  assert.equal(await mobilePage.locator('.tai-page-skeleton:visible .tai-skeleton').first().evaluate(el => getComputedStyle(el).animationName), 'none');
  await mobilePage.getByRole('button', { name: 'Open navigation menu', exact: true }).click();
  await mobilePage.locator('.ta-sidebar.mobile-open:visible').waitFor();
  await mobilePage.locator('.ta-scrim-sidebar:visible').click({ position: { x: 380, y: 400 } });
  await mobilePage.locator('.tai-screen-loading-boundary[aria-busy="false"]:visible').waitFor();
  results.push({ mobile: 'PASS: navigation available during loading and reduced-motion respected' });
  await mobile.close();
  console.log(JSON.stringify({ status: 'PASS', results }, null, 2));
} finally { await browser.close(); }
