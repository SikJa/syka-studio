import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire(resolve('.runtime/personalization/package.json'));
const { chromium } = require('playwright');
const browser = await chromium.launch({channel:'chrome',headless:true});
const context = await browser.newContext({viewport:{width:1280,height:900}});
// No provider/remote requests during this local Settings integration smoke test.
await context.route('**/*', route => {
  const url = new URL(route.request().url());
  return url.hostname === '127.0.0.1' && url.port === '5396' ? route.continue() : route.abort();
});
const page = await context.newPage();
const errors=[]; page.on('pageerror',e=>errors.push(e.message));
try {
  await page.goto('http://127.0.0.1:5396/?dashboard=settings',{waitUntil:'domcontentloaded',timeout:90000});
  const trigger=page.getByRole('button',{name:'Elegir color de acento'});
  await trigger.waitFor({timeout:90000});
  await trigger.click(); await page.getByRole('button',{name:'Lavanda',exact:true}).click();
  await page.getByRole('button',{name:'Aplicar color'}).click();
  await page.reload(); await trigger.waitFor(); assert.ok((await trigger.innerText()).includes('#A78BFA'));
  await trigger.click(); await page.waitForTimeout(250);
  await mkdir(resolve('output/personalization'),{recursive:true});
  await page.screenshot({path:resolve('output/personalization/settings-integrated.png')});
  assert.deepEqual(errors,[]);
  const result={passed:true,scope:'Actual web app Settings/bootstrap in isolated browser, remote requests blocked, no Electron or personal data',errors};
  await writeFile(resolve('output/personalization/integration-results.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
} catch (error) {
  console.error(JSON.stringify({errors,body:(await page.locator('body').innerText()).slice(0,2000)},null,2));
  throw error;
} finally {await browser.close();}
