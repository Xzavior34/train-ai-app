import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.TEMP, 'trainai-learner-visual/node_modules/playwright-core'));
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const results = [];
fs.mkdirSync('docs/audit/learner-cleanup', { recursive: true });
try {
  for (const role of ['admin', 'owner']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:5188/?fixture_role=' + role);
    await page.locator('.ta-sidebar:visible').waitFor();
    const reject = page.getByRole('button', { name: 'Reject non-essential', exact: true });
    if (await reject.isVisible()) await reject.click();
    if (role === 'owner') {
      await page.locator('.ta-nav-switcher-btn:visible').click();
      await page.locator('.ta-ws-item:visible').filter({ hasText: 'Platform Owner Dashboard' }).click();
      await page.keyboard.press('Escape');
      await page.getByText('Dashboard Switcher', { exact: true }).waitFor({ state: 'hidden' });
    }
    if (role === 'admin') {
      await page.locator('.ta-sidebar .ta-nav-item').filter({ hasText: /^Workforce Intelligence$/ }).click();
      await page.getByText('Workforce Intelligence & Skill Radar', { exact: true }).waitFor();
    }
    const footerHeight = await page.locator('.ta-sidebar-tools:visible').evaluate(el => el.getBoundingClientRect().height);
    if (footerHeight > 60) throw Error(role + ' sidebar controls take too much height: ' + footerHeight);
    if (role === 'admin') {
      const margins = await page.locator('.ta-content').evaluate(el => ({ left: parseFloat(getComputedStyle(el).paddingLeft), right: parseFloat(getComputedStyle(el).paddingRight) }));
      if (margins.left < 16 || margins.right < 16) throw Error('Missing desktop content margins');
    }
    for (const width of [1440, 390, 360, 768]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForTimeout(350);
      const state = await page.evaluate(() => {
        const hero = [...document.querySelectorAll('.ta-hero-banner')].find(el => el.getClientRects().length);
        return { overflow: document.documentElement.scrollWidth > innerWidth + 2,
          heroShadow: hero ? getComputedStyle(hero).boxShadow : null,
          crash: /Something went wrong|Application error|Could not verify your workspace access/.test(document.body.innerText) };
      });
      results.push({ role, width, ...state });
      await page.screenshot({ path: `docs/audit/learner-cleanup/${role}-${width}.png` });
      if (state.overflow || state.crash || (state.heroShadow && state.heroShadow !== 'none') || errors.length) throw Error(JSON.stringify({ role, width, ...state, errors }));
    }
    await context.close();
  }
  console.log(JSON.stringify({ status: 'PASS', results }, null, 2));
} finally { await browser.close(); }
