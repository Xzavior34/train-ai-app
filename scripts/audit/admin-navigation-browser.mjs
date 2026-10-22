import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(process.env.TEMP, 'trainai-learner-visual/node_modules/playwright-core'));
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const results = [];
try {
  for (const role of ['admin', 'owner']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    await context.addInitScript(() => { window.__auditQueries = []; window.__auditApiCalls = []; });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:5188/?fixture_role=' + role);
    await page.locator('.ta-topbar:visible').waitFor();
    const reject = page.getByRole('button', { name: 'Reject non-essential', exact: true });
    if (await reject.isVisible()) await reject.click();
    await page.evaluate(() => { window.__auditQueryDelay = 6000; window.__auditQueries = []; });
    const labels = role === 'admin' ? ['Users & Access', 'Courses', 'Cohorts', 'Seats & Licensing', 'Settings Hub'] : ['Organizations', 'Demo Requests', 'Access Control', 'Platform Settings'];
    for (const label of labels) {
      const oldHeader = await page.locator('.ta-topbar:visible').elementHandle();
      const start = Date.now();
      await page.locator('.ta-sidebar:visible .ta-nav-item').filter({ hasText: label }).first().click();
      await page.waitForFunction(el => !el.isConnected, oldHeader);
      await page.locator('.ta-topbar:visible').waitFor();
      const headerMs = Date.now() - start;
      assert(headerMs < 1800, `${role} ${label}: navigation waits for six-second data requests (${headerMs}ms)`);
      assert.equal(await page.locator('.ta-screen-content[hidden]:visible').count(), 0);
      if (label === 'Users & Access') {
        assert(await page.getByRole('status', { name: 'Loading members...', exact: true }).isVisible());
        const hiddenTabs = await page.evaluate(() => window.__auditQueries.some(source => /fetchOrgInstructorsMonitor|fetchAllDSARRequests|fetchOrgRolePermissions|fetchMentorApplications/.test(source)));
        assert.equal(hiddenTabs, false, 'Unopened tabs must not queue requests');
        await page.getByRole('status', { name: 'Loading members...', exact: true }).waitFor({ state: 'hidden', timeout: 12000 });
        await page.evaluate(() => { window.__auditQueryDelay = 50; });
        await page.locator('.ta-tab').filter({ hasText: /^Privileges & Roles$/ }).click();
        await page.waitForFunction(() => window.__auditApiCalls.includes('fetchOrgRolePermissions'));
        await page.evaluate(() => { window.__auditQueryDelay = 6000; });
      }
      if (label === 'Seats & Licensing') {
        const pay = page.getByRole('button').filter({ hasText: /Pay|Buy|Purchase/ }).first();
        if (await pay.count()) assert(await pay.isDisabled(), 'Payment must wait for live pricing');
      }
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      await page.setViewportSize({ width: 1440, height: 1000 });
      results.push({ role, page: label, dataDelayMs: 6000, headerMs });
    }
    assert.equal(errors.length, 0, errors.join('\n'));
    await context.close();
  }
} finally { await browser.close(); }
fs.writeFileSync('docs/audit/admin-performance/navigation.json', JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
