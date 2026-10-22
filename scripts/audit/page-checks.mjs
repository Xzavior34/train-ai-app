// Functional browser checks against the isolated local preview only.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(process.env.TEMP, 'trainai-learner-visual/node_modules/playwright-core'));
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const results = [];
const reportPath = process.env.AUDIT_REPORT_PATH || 'docs/audit/page-browser-results.json';
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
const roles = process.argv.slice(2);
for (const role of (roles.length ? roles : ['public', 'learner', 'mentor', 'admin', 'manager', 'owner'])) {
 const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
 // Keep the preview local; external integrations are outside this check.
 await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
 const page = await context.newPage();
 const errors = [];
 page.on('pageerror', error => errors.push(error.message));
 page.on('console', message => { if(message.type()==='error' && /ErrorBoundary/.test(message.text())) errors.push(message.text()); });
 async function inspect(name) {
  await page.waitForTimeout(120);
  const state = await page.evaluate(() => ({
   headings: [...document.querySelectorAll('h1,h2,h3')].filter(el=>el.getClientRects().length).map(el=>el.textContent.trim()).slice(0,10),
   text: document.body.innerText.slice(-700),
   overflow: document.documentElement.scrollWidth > innerWidth + 2,
   brokenImages: [...document.images].filter(img=>img.complete && img.naturalWidth===0).map(img=>img.getAttribute('src')),
   crash: /Something went wrong|Application error|Could not verify your workspace access/.test(document.body.innerText),
  }));
  results.push({ role, name, ...state, errors: errors.splice(0) });
  fs.writeFileSync(reportPath,JSON.stringify(results,null,2));
  console.log(JSON.stringify({role,name,headings:state.headings,overflow:state.overflow,crash:state.crash,errors:results.at(-1).errors}));
 }
 await page.goto('http://127.0.0.1:5188/?fixture_role='+role);
 await page.waitForFunction(() => !/Loading your account|Loading\.\.\./.test(document.body.innerText), {timeout:15000});
 await inspect('initial');
 const rejectCookies=page.getByRole('button',{name:'Reject non-essential',exact:true});
 if(await rejectCookies.isVisible()) await rejectCookies.click();
 if(role==='owner') {
  await page.locator('.ta-nav-switcher-btn:visible').click();
  await page.locator('.ta-ws-item').filter({hasText:'Platform Owner Dashboard'}).click();
  await inspect('owner dashboard');
 }
 if(role==='public') {
  for (const route of ['/?view=auth&mode=signin','/?view=auth&mode=signup','/marketplace','/verify','/?view=book-demo']) {
   await page.goto('http://127.0.0.1:5188'+route);
   await page.waitForFunction(() => !/Loading your account|Loading\.\.\./.test(document.body.innerText));
   await inspect(route);
   await page.setViewportSize({width:390,height:844}); await inspect(route+' mobile');
   await page.setViewportSize({width:1440,height:1000});
  }
 } else {
  const selector = role==='learner' ? '.tai-sidebar-nav-list .tai-sub-item:visible' : '.ta-sidebar-nav .ta-nav-group .ta-nav-item:visible, .ta-sidebar-nav > .ta-nav-item:visible';
  const groups = page.locator(role==='learner' ? '.tai-category-header' : '.ta-group-header');
  // Expand sections that are collapsed, leaving already expanded sections alone.
  for(let i=0;i<await groups.count();i++) {
   const group=groups.nth(i);
   const expanded=await group.evaluate(el=>!!el.parentElement.querySelector('.tai-sub-items,.ta-group-items'));
   if(!expanded) await group.click();
  }
  const labels=await page.locator(selector).evaluateAll(els=>els.map(el=>el.getAttribute('title')||el.textContent.trim()).filter(label=>! /Sign Out|Theme|Dashboard Switcher/.test(label)));
  for(const label of labels) {
   const item=page.locator(selector).filter({hasText:label}).first();
   if(await item.count()) {
    await item.click(); await inspect(label);
    await page.setViewportSize({width:390,height:844}); await inspect(label+' mobile');
    await page.setViewportSize({width:1440,height:1000});
   }
  }
  await page.setViewportSize({width:390,height:844}); await inspect('mobile current page');
 }
 await context.close();
}
await browser.close();
fs.mkdirSync('docs/audit',{recursive:true});
fs.writeFileSync(reportPath,JSON.stringify(results,null,2));
if(results.some(row=>row.crash||row.errors.length)) process.exitCode=1;
