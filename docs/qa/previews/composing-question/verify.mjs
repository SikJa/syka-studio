import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
const out=resolve('../Pruebas Syka/Composing-pregunta-4-previews-2026-10-08');
const evidence=join(out,'evidence');await mkdir(evidence,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const results={scope:'Interactive prototypes, not an integrated production chat',variants:[],errors:[]};
try{
 for(let v=1;v<=4;v++){
  const context=await browser.newContext({viewport:{width:560,height:900},deviceScaleFactor:1,recordVideo:{dir:join(evidence,'recordings'),size:{width:560,height:900}}});
  const page=await context.newPage();const video=page.video();
  page.on('pageerror',error=>results.errors.push(error.message));
  await page.goto('http://127.0.0.1:5331/?mode=clip&v='+v);await page.waitForLoadState('networkidle');
  await page.waitForFunction(()=>window.sykaPreview?.phase==='question');await page.waitForTimeout(500);
  const general=page.getByRole('textbox',{name:'Mensaje general',includeHidden:true});
  assert.equal(await general.isDisabled(),true);
  assert.equal(await page.getByRole('button',{name:'Nueva conversación',includeHidden:true}).isDisabled(),true);
  assert.equal(await page.locator('.chat-background').evaluate(e=>e.inert),true);
  assert.equal(await page.getByRole('button',{name:'Continuar con mi respuesta'}).isDisabled(),true);
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>window.sykaPreview.phase),'question');
  await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>Boolean(document.activeElement?.closest('[role=dialog]'))),true);
  const geometry=await page.evaluate(()=>{const a=document.querySelector('.chat').getBoundingClientRect(),b=document.querySelector('.waiting-foot').getBoundingClientRect(),c=document.querySelector('.continue').getBoundingClientRect();return{footerOverflow:b.bottom-a.bottom,continueOverflow:c.bottom-a.bottom};});
  await page.evaluate(()=>document.activeElement?.blur());
  await page.screenshot({path:join(out,`0${v}-question.png`)});
  const before=await page.locator('.orb-mover canvas').screenshot();await page.waitForTimeout(450);const after=await page.locator('.orb-mover canvas').screenshot();
  assert.notEqual(before.toString('base64'),after.toString('base64'));
  await page.waitForTimeout(1700);
  if(v===4){await page.getByRole('textbox',{name:'Tu respuesta'}).fill('Íntimo y poético. Que la música acompañe el cierre.');}
  else await page.getByRole('button',{name:v===3?'O elegí vos la dirección':'Poético y abstracto',exact:false}).click();
  assert.equal(await page.getByRole('button',{name:'Continuar con mi respuesta'}).isEnabled(),true);
  await page.waitForTimeout(850);await page.getByRole('button',{name:'Continuar con mi respuesta'}).click();
  await page.waitForFunction(()=>window.sykaPreview?.phase==='building');
  assert.equal(await general.isEnabled(),true);assert.equal(await page.locator('.chat-background').evaluate(e=>e.inert),false);
  assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'Mensaje general');
  await page.waitForTimeout(2400);
  const state=await page.evaluate(()=>window.sykaPreview);
  await context.close();
  const webm=await video.path(),mp4=join(out,`0${v}-${['Foco','Orbita','Acople','Lienzo'][v-1]}.mp4`);
  execFileSync('C:/ffmpeg/bin/ffmpeg.exe',['-hide_banner','-loglevel','error','-y','-i',webm,'-an','-vf','fps=30','-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',mp4],{windowsHide:true});
  results.variants.push({variant:v,geometry,state,clip:mp4,checks:['composing canvas changes','chat inert until answered','composer and session controls disabled','Escape keeps question','keyboard focus stays in dialog','option/delegation/free-text answers','chat resumes and composer gains focus']});
  console.log('PREVIEW_VERIFIED '+v+' '+JSON.stringify(geometry));
 }
 const reduced=await browser.newPage({viewport:{width:560,height:900},reducedMotion:'reduce'});
 await reduced.goto('http://127.0.0.1:5331/?mode=clip&v=1');await reduced.waitForLoadState('networkidle');await reduced.waitForFunction(()=>window.sykaPreview?.phase==='question');await reduced.waitForTimeout(400);
 const a=await reduced.locator('.orb-mover canvas').screenshot();await reduced.waitForTimeout(500);const b=await reduced.locator('.orb-mover canvas').screenshot();assert.equal(a.toString('base64'),b.toString('base64'));
 await reduced.getByRole('button',{name:'Poético y abstracto',exact:false}).click();await reduced.getByRole('button',{name:'Continuar con mi respuesta'}).click();await reduced.waitForFunction(()=>!window.sykaPreview.pending);results.reducedMotion={canvasFrozen:true,answerWorks:true};await reduced.close();
 const mobile=await browser.newPage({viewport:{width:390,height:844}});await mobile.goto('http://127.0.0.1:5331/?v=4');await mobile.waitForLoadState('networkidle');await mobile.waitForFunction(()=>window.sykaPreview?.phase==='question');await mobile.waitForTimeout(400);
 results.mobile=await mobile.evaluate(()=>{const chat=document.querySelector('.chat').getBoundingClientRect(),footer=document.querySelector('.waiting-foot').getBoundingClientRect();return{horizontalOverflow:document.documentElement.scrollWidth-innerWidth,questionFooterOverflow:footer.bottom-chat.bottom}});
 await mobile.screenshot({path:join(evidence,'mobile-390.png'),fullPage:true});await mobile.close();
 assert.equal(results.errors.length,0);
 await writeFile(join(out,'verification.json'),JSON.stringify(results,null,2));
 console.log('PREVIEWS_COMPLETE '+out);
}finally{await browser.close();}
