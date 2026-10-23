import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.TEMP, 'trainai-learner-visual/node_modules/playwright-core'));
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
fs.mkdirSync('docs/audit/cohort-mobile', { recursive: true });
try {
  for (const width of [320, 390, 540, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    await page.goto('http://127.0.0.1:5188/?fixture_cohort_test');
    await page.getByLabel('Switch cohort').waitFor();
    assert.equal(await page.getByRole('button', { name: /Extend timeline/i }).count(), 0, 'An email containing admin must not grant management tools');
    await page.getByLabel('Switch cohort').selectOption('flip-fixture');
    await page.getByRole('heading', { name: 'FLIP Fellow C2', exact: true }).waitFor();
    await page.getByText('Welcome to FLIP', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'CAP programme' }).count(), 0);
    await page.getByRole('button', { name: 'Courses (0)', exact: true }).click();
    assert.equal(await page.getByText('Unrelated enrolled course', { exact: true }).count(), 0);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Page must fit viewport at ' + width);
    await page.getByLabel('Switch cohort').selectOption('cap-fixture');
    await page.getByRole('button', { name: /Discussion/ }).click();
    await page.screenshot({ path: `docs/audit/cohort-mobile/learner-${width}.png`, fullPage: true });
    assert.deepEqual(errors, []);
    await page.close();
  }
  for (const mode of ['error', 'empty', 'loading']) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto('http://127.0.0.1:5188/?fixture_cohort_test&cohort_mode=' + mode);
    if (mode === 'error') {
      await page.getByRole('alert').waitFor();
      assert.ok(!(await page.locator('body').innerText()).includes('You have no cohort assignments'));
      await page.getByRole('button', { name: 'Retry', exact: true }).click();
      await page.getByText('You have no cohort assignments yet.', { exact: false }).waitFor();
    } else if (mode === 'loading') {
      await page.getByLabel('Loading your cohort...').waitFor();
      assert.ok(!(await page.locator('body').innerText()).includes('You have no cohort assignments'));
    } else await page.getByText('You have no cohort assignments yet.', { exact: false }).waitFor();
    await page.close();
  }
  console.log('PASS: cohort selection, mobile layout, scoped curriculum, management controls, loading/error/empty recovery');
} finally { await browser.close(); }
