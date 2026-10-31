import {chromium} from 'playwright-core';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const output=resolve('output/playwright/oct22-controls'); await mkdir(output,{recursive:true});
const before=process.argv.includes('--before');
const browser=await chromium.launch({headless:true,executablePath:'C:/Users/CHAMP/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe'});
const errors=[],results=[];
try{
 for(const width of before?[900]:[1440,768,390]){
  const page=await browser.newPage({viewport:{width,height:850},reducedMotion:'reduce'});
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:5237/qa/oct22-controls.html');
  await page.getByRole('heading',{name:'Syka · Controles del editor'}).waitFor();
  await page.screenshot({path:resolve(output,`orb-${before?'before':'after'}-${width}.png`),fullPage:true});
  if(before){await page.close();continue;}
  await page.locator('[data-tour-target="model-picker"]').click();
  const dialog=page.getByRole('dialog',{name:'Ajustes de modelo'});
  await dialog.waitFor();
  const search=page.getByRole('searchbox',{name:'Buscar modelo o proveedor'});
  await search.fill('claude');
  if(await dialog.getByRole('radio').count()!==1)throw Error('Provider search did not narrow to Claude');
  await page.screenshot({path:resolve(output,`picker-filtered-${width}.png`),fullPage:true});
  await dialog.getByRole('radio').click();
  await dialog.waitFor({state:'hidden'});
  if(!(await page.getByTestId('selected').innerText()).startsWith('claude:opus'))throw Error('Selection did not reach composer');
  await page.locator('[data-tour-target="model-picker"]').click();
  await search.fill('zzzz-no-model');
  await page.getByText('No hay modelos que coincidan con la búsqueda.').waitFor();
  await search.fill('OpenCode'); await search.press('ArrowDown'); await page.keyboard.press('Enter');
  await dialog.waitFor({state:'hidden'});
  if(!(await page.getByTestId('selected').innerText()).startsWith('opencode:deepseek'))throw Error('Keyboard selection failed');
  await page.locator('[data-tour-target="model-picker"]').click();
  await search.fill('');
  const bounds=await dialog.boundingBox();
  if(!bounds||bounds.x<0||bounds.x+bounds.width>width+1||bounds.y<0||bounds.y+bounds.height>851)throw Error(`Menu overflow ${JSON.stringify(bounds)}`);
  await page.screenshot({path:resolve(output,`picker-${width}.png`),fullPage:true});
  results.push({width,search:true,keyboard:true,closeOnSelect:true,emptyState:true,bounds});
  await page.close();
 }
 await writeFile(resolve(output,`report-${before?'before':'after'}.json`),JSON.stringify({results,errors},null,2));
 console.log(JSON.stringify({results,errors,output}));
 if(errors.length)throw Error(errors.join('\n'));
}finally{await browser.close();}
