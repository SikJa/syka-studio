import {chromium} from 'playwright-core';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const output=resolve('output/playwright/thinking-logos');await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1100}});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
try{
  await page.goto('http://127.0.0.1:5198/thinking-logos.html');
  await page.waitForFunction(()=>document.querySelectorAll('.logo-card img').length===110);
  assert.equal(await page.locator('.logo-card').count(),110);
  await page.getByRole('button',{name:'Ver Notion',exact:true}).click();await page.locator('.gallery-stage').scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>Number(document.querySelector('.stage-orb [data-brand=notion] canvas')?.dataset.frame)>.2);
  await page.screenshot({path:resolve(output,'production-gallery.png')});
  await page.getByRole('button',{name:'Las 40 nuevas'}).click();assert.equal(await page.locator('.logo-card').count(),40);
  await page.getByRole('button',{name:'Las 40 nuevas'}).click();
  await page.getByRole('button',{name:'Ver MongoDB',exact:true}).click();await page.locator('.gallery-stage').scrollIntoViewIfNeeded();
  await page.getByRole('button',{name:'Error',exact:true}).click();assert.equal(await page.locator('.activity-example [data-failed=true]').count(),1);
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.querySelectorAll('[data-moving=true]').length===0);
  assert.deepEqual(errors,[]);await writeFile(resolve(output,'production-verification.json'),JSON.stringify({catalogCount:110,compiledBundle:true,animated:true,filters:true,errorStatus:true,reducedMotion:true,errors},null,2));
  console.log('Compiled gallery passed: 110 lazy-loaded marks, animation, filters, error and reduced motion.');
}finally{await browser.close();}
