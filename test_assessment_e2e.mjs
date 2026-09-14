import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto('http://localhost:4173/');
await page.waitForTimeout(700);
await page.locator('text=/sign in/i').first().click();
await page.waitForTimeout(250);
await page.locator('text=/sign up/i').first().click();
await page.waitForTimeout(250);
const accept = page.locator('text=/accept all/i').first();
if (await accept.count()) await accept.click();
await page.locator('text=/individual learner/i').first().click();
await page.fill('input[placeholder="you@example.com"]', 'assessmente2e@example.com');
await page.fill('input[placeholder="••••••••"]', 'whatever123');
await page.locator('button[type=submit]').click();
await page.waitForTimeout(1200);
await page.locator('.tai-bottom-nav >> text=/courses/i').click({ force: true }).catch(async () => { await page.locator('text=/^courses$/i').last().click({force:true}); });
await page.waitForTimeout(700);
await page.screenshot({ path: '/tmp/shot_courses_populated.png' });

await page.locator('text=/AI Fundamentals/i').first().click();
await page.waitForTimeout(700);
await page.screenshot({ path: '/tmp/shot_course_detail_tabs.png' });

await page.locator('.tai-pill:has-text("Assessment")').click();
await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/shot_assessment_tab.png' });

console.log('errors:', JSON.stringify(errors));
await browser.close();
