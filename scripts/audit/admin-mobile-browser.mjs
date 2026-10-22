// Run against the isolated website fixture, never against production data.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(process.env.TEMP, 'trainai-learner-visual/node_modules/playwright-core'));
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const results = [];
const output = 'docs/audit/admin-mobile';
fs.mkdirSync(output, { recursive: true });
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
    const groups = page.locator('.ta-sidebar:visible .ta-group-header');
    for (let i = 0; i < await groups.count(); i++) {
      if (!await groups.nth(i).evaluate(el => !!el.parentElement.querySelector('.ta-group-items'))) await groups.nth(i).click();
    }
    const selector = '.ta-sidebar:visible .ta-sidebar-nav .ta-nav-item';
    const labels = (await page.locator(selector).allTextContents()).filter(label => !/Sign Out|Dashboard Switcher/.test(label));
    for (const label of labels) {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.locator(selector).filter({ hasText: label.trim() }).first().click();
      await page.locator('.ta-main:visible .ta-screen-content:not([hidden])').waitFor();
      console.log(role + ': ' + label.trim());
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.waitForTimeout(150);
        const state = await page.evaluate(() => {
          const bar = [...document.querySelectorAll('.ta-topbar')].find(el => el.getClientRects().length);
          const rect = bar?.getBoundingClientRect();
          const heading = bar?.querySelector('.ta-topbar-heading').getBoundingClientRect();
          const sub = bar?.querySelector('.ta-sub');
          return {
            overflow: document.documentElement.scrollWidth > innerWidth + 1,
            headingContained: !bar || (heading.top >= rect.top && heading.bottom <= rect.bottom),
            subtitleFits: !sub || sub.scrollHeight <= sub.clientHeight + 1,
            crash: /Something went wrong|Application error/.test(document.body.innerText),
          };
        });
        results.push({ role, page: label.trim(), width, ...state });
        if (width === 390 && /Demo|Appointment|Dashboard|Overview/.test(label)) await page.screenshot({ path: `${output}/${role}-${label.trim().replace(/[^a-z0-9]/gi, '-')}.png` });
      }
    }
    if (errors.length) throw Error(errors.join('\n'));
    await context.close();
  }
} finally {
  await browser.close();
  fs.writeFileSync(`${output}/results.json`, JSON.stringify(results, null, 2));
}
const failures = results.filter(row => row.overflow || !row.headingContained || (row.width < 900 && !row.subtitleFits) || row.crash);
console.log(JSON.stringify({ checks: results.length, failures }, null, 2));
if (failures.length || !results.length) process.exitCode = 1;
