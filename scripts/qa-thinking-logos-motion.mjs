import {chromium} from 'playwright-core';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:4600}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto('http://127.0.0.1:5198/thinking-logos.html');
  await page.waitForFunction(()=>document.querySelectorAll('.logo-card [data-moving=true]').length===110);
  assert.equal(await page.locator('.syka-logo-anchor').count(),0);
  assert.deepEqual(await page.locator('.actual-sizes .syka-thinking-logo').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().width)),[48,64,96]);
  const results=[];
  for(const state of ['thinking','searching','working','solving','listening','waiting','generating']){
    await page.getByLabel('Estado de la animación').selectOption(state);
    await page.waitForTimeout(800);
    const first=await page.locator('.logo-card canvas').evaluateAll(es=>es.map(e=>e.toDataURL()));
    await page.waitForTimeout(900);
    const second=await page.locator('.logo-card canvas').evaluateAll(es=>es.map(e=>e.toDataURL()));
    const changing=first.filter((value,index)=>value!==second[index]).length;
    assert.equal(changing,110,`${state}: ${changing}/110 changing pixel frames`);
    results.push({state,changing});
  }
  await page.setViewportSize({width:1440,height:1100});
  await page.getByLabel('Estado de la animación').selectOption('searching');
  await page.screenshot({path:'output/playwright/thinking-logos/gallery-motion-corrected.png'});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(()=>!document.querySelector('[data-moving=true]'));
  assert.deepEqual(errors,[]);
  await writeFile('output/playwright/thinking-logos/motion-verification.json',JSON.stringify({compiledBundle:true,catalogCount:110,overlays:0,previewSizes:[48,64,96],results,reducedMotion:true,errors},null,2));
  console.log(JSON.stringify(results));
}finally{await browser.close();}
