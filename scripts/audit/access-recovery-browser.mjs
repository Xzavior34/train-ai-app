import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(process.env.TEMP, 'trainai-learner-visual/node_modules/playwright-core'));
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
  for (const role of ['admin', 'owner']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:5188/?fixture_role=' + role);
    await page.locator('.ta-content:visible').first().waitFor();
    const reject = page.getByRole('button', { name: 'Reject non-essential', exact: true });
    if (await reject.isVisible()) await reject.click();
    await page.locator('.ta-content:visible').first().evaluate(el => { window.__auditOpenPage = el; });
    await page.evaluate(() => { window.__auditRoleError = new TypeError('Failed to fetch'); window.dispatchEvent(new Event('trainai-role-changed')); });
    await page.locator('.workspace-connection-notice').waitFor();
    assert.equal(await page.evaluate(() => window.__auditOpenPage.isConnected), true, 'Background network failure must preserve the mounted page');
    assert.equal(await page.locator('.access-recovery').count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await page.evaluate(() => { window.__auditRoleError = null; window.dispatchEvent(new Event('online')); });
    await page.locator('.workspace-connection-notice').waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => window.__auditOpenPage.isConnected), true);
    await page.evaluate(() => { window.__auditRoleError = { message: 'Permission denied', status: 403 }; window.dispatchEvent(new Event('trainai-role-changed')); });
    await page.locator('.access-recovery').waitFor();
    assert.equal(await page.locator('.ta-content:visible').count(), 0);
    // A network failure after a denial must not reopen previously granted access.
    await page.evaluate(() => { window.__auditRoleError = new TypeError('Failed to fetch'); });
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await page.getByRole('heading', { name: 'We couldn’t connect to your workspace' }).waitFor();
    assert.equal(await page.locator('.ta-content:visible').count(), 0);
    await page.evaluate(() => { window.__auditRoleError = null; });
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await page.locator('.ta-content:visible').first().waitFor();
    console.log(role + ': network interruption, reconnection, access denial and retry PASS');
    await context.close();
  }
} finally { await browser.close(); }
