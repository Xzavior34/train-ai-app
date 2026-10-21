import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(path.join(process.env.TEMP,'trainai-page-check/node_modules/playwright-core'));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
const page=await context.newPage();
const errors=[],results=[];
page.on('pageerror',e=>errors.push(e.message));
async function check(name,run){try{await run();results.push({name,status:'PASS'});}catch(e){results.push({name,status:'FAIL',message:e.message});} console.log(JSON.stringify(results.at(-1)));fs.writeFileSync('docs/audit/page-interaction-results.json',JSON.stringify({checks:results,errors},null,2));}
async function open(route){await page.goto('http://127.0.0.1:5188'+route);await page.waitForFunction(()=>! /Loading your account|Loading\.\.\./.test(document.body.innerText));const reject=page.getByRole('button',{name:'Reject non-essential',exact:true});if(await reject.isVisible())await reject.click();}
await check('Sign-in password visibility and sign-up browser Back',async()=>{
 await open('/?fixture_role=public');await open('/?view=auth&mode=signin');
 await page.getByRole('button',{name:'Show password',exact:true}).click();assert.equal(await page.getByLabel('Password',{exact:true}).getAttribute('type'),'text');
 await page.getByRole('button',{name:'Hide password',exact:true}).click();assert.equal(await page.getByLabel('Password',{exact:true}).getAttribute('type'),'password');
 await page.getByRole('button',{name:'Sign up',exact:true}).click();await page.getByRole('heading',{name:'Create your account'}).waitFor();
 await page.goBack();await page.getByRole('heading',{name:'Welcome back'}).waitFor();
});
await check('Forgot-password form opens',async()=>{await page.getByRole('button',{name:'Forgot password?',exact:true}).click();await page.getByRole('button',{name:/Send.*reset/i}).waitFor();});
await check('Marketplace dialog closes with Escape and restores focus on mobile',async()=>{
 await open('/marketplace');await page.setViewportSize({width:390,height:844});
 const details=page.getByRole('button',{name:/View course details/}).first();await details.click();
 const dialog=page.getByRole('dialog');await dialog.waitFor();
 const box=await dialog.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390);
 await page.keyboard.press('Tab');assert.ok(await dialog.evaluate(el=>el.contains(document.activeElement)));
 await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});assert.ok(await details.evaluate(el=>el===document.activeElement));
 await page.getByRole('button',{name:/Instructor Seat Plans/}).click();assert.ok(await page.getByText('plans',{exact:false}).count());
});
await check('Users & Access tabs, table scrolling, filtering and invite dialog',async()=>{
 await page.setViewportSize({width:1440,height:1000});await open('/?fixture_role=admin');
 await page.locator('.ta-nav-item[title="Users & Access"]:visible').click();
 const tabs=page.getByRole('tab');assert.equal(await tabs.count(),9);
 for(let i=0;i<9;i++){await tabs.nth(i).click();await page.waitForTimeout(70);assert.equal(await tabs.nth(i).getAttribute('aria-selected'),'true');assert.ok(!/Something went wrong/.test(await page.locator('body').innerText()));}
 await tabs.first().click();const search=page.getByPlaceholder('Search by name, email, role or department...');await search.fill('no-such-learner-xyz');await page.getByText('No members match your filters.',{exact:true}).waitFor();await search.fill('');
 await page.setViewportSize({width:390,height:844});
 const region=page.getByRole('region',{name:'Member directory table'});assert.ok(await region.evaluate(el=>el.scrollWidth>el.clientWidth));
 await page.getByRole('button',{name:'Scroll Member directory table right',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[aria-label="Member directory table"]').scrollLeft>0);
 await page.getByRole('button',{name:'Invite User',exact:true}).click();await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'detached'});
 await page.setViewportSize({width:1440,height:1000});
 const priya=page.getByRole('row').filter({hasText:'Priya Nair'}).first();
 await priya.locator('[title="Open member record"]').click();
 await page.getByText('Preview data · sample learning progress',{exact:true}).waitFor();
 assert.ok(!/invalid input syntax|type uuid/.test(await page.getByRole('dialog').innerText()));
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);
 await page.screenshot({path:'docs/audit/member-track-fixed-mobile.png',fullPage:false});
 await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'detached'});
 await page.setViewportSize({width:390,height:844});
 await page.waitForTimeout(400);await page.screenshot({path:'docs/audit/page-people-mobile.png',fullPage:false});
});
await check('Manager search only offers working manager pages',async()=>{
 await page.setViewportSize({width:1440,height:1000});await open('/?fixture_role=manager');await page.keyboard.press('Control+k');
 const search=page.getByPlaceholder('Search students, courses, cohorts, and navigation...');await search.fill('workforce');await page.getByRole('dialog').getByText('Workforce Intelligence',{exact:true}).click();await page.getByRole('heading',{name:/Workforce/}).waitFor();
 await page.keyboard.press('Control+k');await search.fill('courses');await page.getByText('No matches found for "courses"',{exact:true}).waitFor();await page.keyboard.press('Escape');
});
await check('Owner search opens the owner Organizations page',async()=>{
 await open('/?fixture_role=owner');await page.locator('.ta-nav-switcher-btn:visible').click();await page.locator('.ta-ws-item').filter({hasText:'Platform Owner Dashboard'}).click();await page.keyboard.press('Control+k');
 assert.equal(await page.getByRole('dialog').count(),1);
 await page.getByPlaceholder('Search students, courses, cohorts, and navigation...').fill('organizations');await page.getByRole('dialog').getByText('Organizations',{exact:true}).click();await page.locator('.ta-nav-item[title="Organizations"].active:visible').waitFor();
});
await check('Theme stays dark after switching from staff to learner',async()=>{
 await open('/?fixture_role=admin');await page.locator('[title="Switch to Dark Mode"]:visible').click();await page.locator('.ta-nav-switcher-btn:visible').click();await page.locator('.ta-ws-item').filter({hasText:'Learner Dashboard'}).click();assert.ok(await page.locator('html').evaluate(el=>el.classList.contains('dark')));
 await page.waitForTimeout(500);await page.screenshot({path:'docs/audit/page-learner-dark.png',fullPage:false});
});
assert.deepEqual(errors,[]);
await context.close();await browser.close();
if(results.some(row=>row.status==='FAIL'))process.exitCode=1;
