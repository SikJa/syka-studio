// React integration with a mocked upload bridge; native storage is checked
// separately by qa-studio-notifications.mjs. No real provider calls.
import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';
const output = resolve('output/notification-photos-20261010');
await mkdir(output,{recursive:true});
const browser = await chromium.launch({headless:true});
const page = await browser.newPage({viewport:{width:370,height:480}});
const result = {checks:[],errors:[],provider:'mocked upload bridge',paidCalls:false};
page.on('pageerror',error=>result.errors.push(error.message));
await page.addInitScript(()=>{
  const listeners = new Map(), images = new Map();
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aU1cAAAAASUVORK5CYII=';
  const snapshot={accent:'#008cff',sound:false,notices:[{id:'photo-question',kind:'question',title:'Syka tiene una pregunta',projectId:'photo-project',projectDir:'qa-only',projectName:'QA fotos',chatId:'original-chat',createdAt:Date.now(),request:{id:'original-request',questions:[{id:'format',question:'¿Qué formato querés?',options:[{label:'16:9'},{label:'9:16'}],multiSelect:false},{id:'style',question:'¿Qué estilo querés?',options:[{label:'Música'},{label:'Sonidos'}],multiSelect:true}]}}]};
  window.qaAnswer=null;
  window.desktop={platform:'win32',on(channel,handler){const handlers=listeners.get(channel)||new Set();handlers.add(handler);listeners.set(channel,handlers);return()=>handlers.delete(handler);},send(channel,request){
    if(channel!=='main:request')return;
    let data=request.channel==='syka:notifications'?snapshot:{configured:false},error;
    if(request.data.action==='attach-file'){
      if(request.data.name==='fallo.png')error='No se pudo leer la foto.';
      else{const photo={id:crypto.randomUUID(),name:request.data.name,mimeType:'image/png',size:request.data.bytes.length,previewUrl:png};images.set(photo.id,photo);data={...snapshot,attachedFile:photo};}
    }
    if(request.data.action==='remove-file')images.delete(request.data.attachmentId);
    if(request.data.action==='answer')window.qaAnswer=request.data;
    queueMicrotask(()=>{for(const handler of listeners.get('main:response')||[])handler({id:request.id,ok:!error,data,error});});
  }};
});
try {
  await page.goto('http://localhost:5188/notifications.html',{waitUntil:'domcontentloaded'});
  const card = page.locator('.quick-notice'); await card.waitFor(); await page.waitForTimeout(450); await card.locator('.quick-bubble').hover();
  const input = card.locator('input[type="file"]'), textarea = card.getByRole('textbox');
  await card.getByRole('button',{name:'16:9',exact:true}).click(); await card.getByRole('button',{name:'9:16',exact:true}).click();
  assert.equal(await card.getByRole('button',{name:'16:9',exact:true}).getAttribute('aria-pressed'),'false');
  assert.equal(await card.getByRole('button',{name:'9:16',exact:true}).getAttribute('aria-pressed'),'true');
  assert.equal(await card.locator('[data-action="send"]').isEnabled(),true);
  await card.getByRole('button',{name:'9:16',exact:true}).click();
  result.checks.push('single-choice buttons toggle/replace selection and allow sending a choice without text');
  await input.setInputFiles({name:'referencia.png',mimeType:'image/png',buffer:Buffer.from([137,80,78,71])});
  await card.locator('.agent-composer-compact-photo').waitFor();
  assert.equal(await card.locator('[data-action="send"]').isEnabled(),true);
  const dimensions=await card.locator('.agent-composer-compact-photo').evaluate(n=>({w:n.offsetWidth,h:n.offsetHeight,r:getComputedStyle(n).borderRadius}));
  assert.deepEqual(dimensions,{w:32,h:32,r:'8px'});
  const controls = await card.locator('.agent-composer-toolbar-controls button').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {w:r.width,h:r.height,bottom:r.bottom,radius:getComputedStyle(n).borderRadius};}));
  assert.equal(controls.length,3); assert.ok(controls.every(n=>n.w===28&&n.h===28&&n.radius==='8px'));
  assert.ok(Math.max(...controls.map(n=>n.bottom))-Math.min(...controls.map(n=>n.bottom))<1);
  result.checks.push('photo-only send, 32px rounded thumbnail and aligned square plus/voice/metal send controls');
  await textarea.fill('9:16');
  await input.setInputFiles({name:'fallo.png',mimeType:'image/png',buffer:Buffer.from('bad')});
  await card.getByRole('alert').waitFor(); assert.equal(await textarea.inputValue(),'9:16'); assert.equal(await card.locator('.agent-composer-compact-photo').count(),1);
  result.checks.push('failed upload preserves the existing text and photo');
  await card.locator('[data-action="send"]').click();
  await card.getByText('¿Qué estilo querés?',{exact:true}).waitFor();
  assert.equal(await card.locator('.agent-composer-compact-photo').count(),1);
  await card.getByRole('textbox').press('Escape'); await card.locator('.quick-head').click();
  await card.locator('.agent-composer-compact-photo').waitFor();
  assert.equal(await card.getByRole('textbox').inputValue(),'');
  assert.equal(await card.locator('[data-action="send"]').isEnabled(),true);
  result.checks.push('photo survives question steps and manual collapse/reopening');
  await card.getByRole('button',{name:'Música',exact:true}).click(); await card.getByRole('button',{name:'Sonidos',exact:true}).click();
  assert.equal(await card.getByRole('button',{name:'Música',exact:true}).getAttribute('aria-pressed'),'true');
  assert.equal(await card.getByRole('button',{name:'Sonidos',exact:true}).getAttribute('aria-pressed'),'true');
  await card.getByRole('button',{name:'Música',exact:true}).click(); await card.getByRole('button',{name:'Sonidos',exact:true}).click();
  result.checks.push('multiple-choice buttons select and deselect independently without sending early');
  await card.locator('[data-action="send"]').click();
  const sent=await page.evaluate(()=>window.qaAnswer);
  assert.equal(sent.id,'photo-question'); assert.deepEqual(sent.answers.format,['9:16']);
  assert.match(sent.answers.style[0],/archivos adjuntos/); assert.equal(sent.attachments.length,1);
  result.checks.push('all answers and photo IDs are sent together to the original request, including an image-only step');
  assert.deepEqual(result.errors,[]);
} catch(error){result.failure=error.stack;process.exitCode=1;}
finally{await writeFile(join(output,'renderer-qa.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));await browser.close();}
