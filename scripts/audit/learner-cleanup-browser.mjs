import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.TEMP, 'trainai-learner-visual/node_modules/playwright-core'));
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const results = [];
fs.mkdirSync('docs/audit/learner-cleanup', { recursive: true });
async function check(name) {
  await page.waitForTimeout(250);
  const state = await page.evaluate(() => {
    const hero = document.querySelector('.tai-hero-card');
    const icon = document.querySelector('.tai-decoration-icon');
    return {
      width: innerWidth,
      overflow: document.documentElement.scrollWidth > innerWidth + 2,
      hero: hero ? { background: getComputedStyle(hero).backgroundColor, shadow: getComputedStyle(hero).boxShadow } : null,
      icon: icon ? { background: getComputedStyle(icon).backgroundColor, border: getComputedStyle(icon).borderWidth } : null,
      crash: /Something went wrong|Application error|Could not verify your workspace access/.test(document.body.innerText),
    };
  });
  results.push({ name, ...state });
  if (state.overflow || state.crash) throw new Error(name + ': layout overflow or crash ' + JSON.stringify(state));
  if (state.hero && state.hero.shadow !== 'none') throw new Error(name + ': hero shadow persists');
  if (state.icon && (state.icon.background !== 'rgba(0, 0, 0, 0)' || state.icon.border !== '0px')) throw new Error(name + ': decorative icon background persists');
  await page.screenshot({ path: `docs/audit/learner-cleanup/${name}.png`, fullPage: false });
}
try {
  await page.goto('http://127.0.0.1:5188/?fixture_role=learner');
  await page.locator('.tai-desktop-sidebar').waitFor();
  const rejectCookies = page.getByRole('button', { name: 'Reject non-essential', exact: true });
  if (await rejectCookies.isVisible()) await rejectCookies.click();
  await check('home-desktop');
  await page.locator('.tai-sub-item').filter({ hasText: /^Community$/ }).click();
  await page.getByRole('heading', { name: 'Community Hub' }).waitFor();
  await check('community-desktop');
  const background = await page.locator('.tai-community-hero-card').evaluate(el => getComputedStyle(el).backgroundColor);
  if (background !== 'rgb(20, 39, 71)') throw new Error('Community hero was overridden: ' + background);
  for (const width of [360, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await check(`community-${width}`);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('.tai-sub-item').filter({ hasText: /^AI Coach$/ }).click();
  await page.getByRole('button', { name: /Chat History/ }).waitFor();
  await check('coach-desktop');
  await page.getByRole('button', { name: /Chat History/ }).click();
  await page.getByText('Recent AI Learning Sessions', { exact: true }).waitFor();
  await page.getByRole('button', { name: /Chat History/ }).click();
  await page.setViewportSize({ width: 360, height: 844 });
  await check('coach-mobile');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('.tai-sub-item').filter({ hasText: /^Feed$/ }).click();
  await page.getByRole('button', { name: 'Open post by Fixture author' }).waitFor();
  if (await page.getByText('END_OF_FULL_POST', { exact: false }).count()) throw new Error('Feed renders the entire post before opening it');
  await check('feed-desktop');
  await page.getByRole('button', { name: 'Open post by Fixture author' }).click();
  await page.getByText('END_OF_FULL_POST', { exact: false }).waitFor();
  await page.getByText('A comment from another member.', { exact: true }).waitFor();
  await page.getByLabel('Your comment').fill('Fixture reply persists after reopening.');
  await page.getByRole('button', { name: 'Post comment', exact: true }).click();
  await page.getByText('Fixture reply persists after reopening.', { exact: true }).waitFor();
  await check('post-detail-desktop');
  await page.setViewportSize({ width: 360, height: 844 });
  await check('post-detail-mobile');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('heading', { name: 'Community feed', exact: true }).waitFor();
  await check('feed-mobile');
  await page.getByRole('button', { name: /2 comments/ }).click();
  await page.getByText('Fixture reply persists after reopening.', { exact: true }).waitFor();
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(JSON.stringify({ status: 'PASS', results }, null, 2));
} finally {
  await browser.close();
}
