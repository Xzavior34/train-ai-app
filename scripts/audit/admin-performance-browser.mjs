// Controlled local benchmark: 150ms reads and 2500ms secondary-card reads.
// These results compare the same isolated fixture, not real-user network times.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(process.env.TEMP, 'trainai-learner-visual/node_modules/playwright-core'));
const baseline = process.argv.includes('--baseline');
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const results = [];
try {
  for (const role of (baseline ? ['admin', 'owner'] : ['admin', 'owner', 'mentor'])) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    await context.addInitScript(() => {
      window.__auditQueries = []; window.__auditApiCalls = [];
      window.__auditQueryDelay = 150; window.__auditSlowDelay = 2500;
      window.__auditSlowQueries = ['fetchStudentRiskList', 'fetchTopMentors', 'fetchMyAnalysisNotes', 'checkPlatformHealth', 'fetchWebsitePerformanceStats'];
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:5188/?fixture_role=' + role);
    await page.locator('.ta-sidebar').first().waitFor({ state: 'attached' });
    const start = Date.now();
    await page.locator('.ta-content:visible').first().waitFor();
    const readyMs = Date.now() - start;
    await page.waitForTimeout(3000);
    const state = await page.evaluate(() => ({
      queriesStarted: window.__auditQueries.length,
      apiCalls: window.__auditApiCalls.length,
      calls: window.__auditApiCalls,
      hiddenLearnerMounted: !!document.querySelector('.tai-app'),
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
    }));
    results.push({ role, readyMs, ...state });
    assert.equal(errors.length, 0, errors.join('\n'));
    assert.equal(state.overflow, false);
    if (!baseline) {
      assert(readyMs < 1800, role + ' waits for slow secondary cards: ' + readyMs);
      if (role !== 'mentor') assert(!state.calls.includes('fetchMentorProfile'), 'Admin must not fetch instructor data');
      assert(!state.calls.includes('fetchMyGamificationStats'), 'Unopened learner dashboard must not load');
      if (role !== 'mentor') {
        const statsCall = role === 'admin' ? 'fetchOrgDashboardStats' : 'fetchPlatformOverviewStats';
        assert.equal(state.calls.filter(name => name === statsCall).length, 1, 'Do not fetch totals for a placeholder tenant and then repeat them');
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      const reject = page.getByRole('button', { name: 'Reject non-essential', exact: true });
      if (await reject.isVisible()) await reject.click();
      if (role !== 'mentor') await page.locator('.ta-sidebar:visible .ta-nav-item').filter({ hasText: /^Demo Requests$/ }).click();
      const draft = page.getByPlaceholder(role === 'mentor' ? 'Add a note...' : 'Search by name, email, or institution...');
      await draft.fill('Preserve my search');
      await draft.evaluate(el => { window.__auditDraft = el; });
      await page.locator('.ta-nav-switcher-btn:visible').click();
      await page.locator('.ta-ws-item:visible').filter({ hasText: 'Learner Dashboard' }).click();
      await page.locator('.tai-sidebar-footer [title="Switch Workspace"]:visible').click();
      await page.locator('.ta-ws-item:visible').filter({ hasText: role === 'owner' ? 'Platform Owner Dashboard' : 'Organisation Dashboard' }).click();
      await draft.waitFor();
      assert.equal(await draft.inputValue(), 'Preserve my search');
      assert.equal(await page.evaluate(() => window.__auditDraft.isConnected), true, 'Workspace switches must retain drafts');
    }
    await context.close();
  }
} finally { await browser.close(); }
fs.mkdirSync('docs/audit/admin-performance', { recursive: true });
fs.writeFileSync(`docs/audit/admin-performance/${baseline ? 'baseline' : 'optimized'}.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results.map(({ calls, ...summary }) => summary), null, 2));
