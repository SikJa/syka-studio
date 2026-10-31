// UI-only fixture: fake recording IPC and the actual desktop selector HTML.
import { chromium } from 'playwright-core';
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const output='output/playwright/recording-panel';await mkdir(output,{recursive:true});
await build({entryPoints:['apps/desktop/src/screen-region-ui.ts'],bundle:true,platform:'node',format:'esm',outfile:output+'/region-ui.mjs'});
const {screenRegionHtml}=await import(pathToFileURL(resolve(output+'/region-ui.mjs')).href);
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:950,height:700}});
  const errors=[];page.on('pageerror',error=>errors.push(String(error)));
  await page.goto('http://localhost:5188');
  const base='/@fs/'+resolve('.').replaceAll('\\','/').split('/').map(encodeURIComponent).join('/').replace(/^([A-Za-z])%3A/,'$1:');
  await page.evaluate(async({base})=>{
    const {MAIN_CHANNELS,MAIN_WIRE}=await import(base+'/apps/desktop/src/main-channels.ts');
    const listeners=new Map();window.__recordingCalls=[];
    const thumbnail='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#242529"/><text x="65" y="110" fill="white" font-family="Arial" font-size="26">Pantalla de prueba</text></svg>');
    window.desktop={on:(channel,listener)=>{listeners.set(channel,listener);return()=>listeners.delete(channel)},send:(channel,request)=>{
      window.__recordingCalls.push(request.data);queueMicrotask(()=>{
        let data,error;
        if(request.channel===MAIN_CHANNELS.SYKA_SCREEN_CAPTURE&&request.data.action==='list')data={sources:[{id:'screen:0',name:'Pantalla 1',thumbnail,kind:'screen',bounds:{x:0,y:0,width:1920,height:1080}}],systemAudio:true};
        else if(request.channel===MAIN_CHANNELS.SYKA_GROQ_STATUS)data={configured:false};
        else if(request.channel===MAIN_CHANNELS.SYKA_SCREEN_CAPTURE&&request.data.action==='select-region'){
          window.__finishSelection=region=>listeners.get(MAIN_WIRE.RESPONSE)?.({id:request.id,ok:true,data:{sources:[],systemAudio:true,selectedRegion:region}});return;
        }else error='Grabación simulada: ningún video ni audio capturado.';
        listeners.get(MAIN_WIRE.RESPONSE)?.({id:request.id,ok:!error,data,error});
      });
    }};
    const React=await import('/node_modules/.vite/deps/react.js'),DOM=await import('/node_modules/.vite/deps/react-dom_client.js');
    const {ScreenRecordingPanel}=await import('/src/mirel-chat/features/agents/screen-recording-panel.tsx');
    const mount=document.createElement('div');document.body.append(mount);
    (DOM.default??DOM).createRoot(mount).render((React.default??React).createElement(ScreenRecordingPanel,{contextKey:'isolated-recording',projectDir:'isolated-recording',initialRegion:true,onDismiss:()=>{},onSave:()=>{throw Error('Must not save')},onTranscript:()=>{throw Error('Must not transcribe')},onConfigure:()=>{}}));
  },{base});
  const panel=page.getByRole('dialog',{name:'Grabar pantalla'});await panel.waitFor();
  assert.equal(await panel.getByRole('button',{name:'Elegir una zona',exact:true}).getAttribute('aria-pressed'),'true');
  const start=panel.getByRole('button',{name:'Empezar a grabar',exact:true});await start.waitFor();assert.ok(await start.isEnabled());
  assert.equal(await panel.getByLabel('Arrastrá para elegir el área de grabación').count(),0);
  await panel.getByRole('combobox',{name:'Audio de la grabación'}).selectOption('none');
  await page.screenshot({path:output+'/setup.png'});
  await start.click();await page.waitForFunction(()=>typeof window.__finishSelection==='function');assert.equal(await panel.count(),0,'Setup modal must disappear during selection');
  assert.equal((await page.evaluate(()=>window.__recordingCalls)).filter(c=>c?.action==='start').length,0);
  await page.evaluate(()=>{window.__finishSelection(null);window.__finishSelection=undefined});await panel.waitFor();
  assert.equal((await page.evaluate(()=>window.__recordingCalls)).filter(c=>c?.action==='start').length,0,'Cancel cannot start recording');
  await start.click();await page.waitForFunction(()=>typeof window.__finishSelection==='function');
  await page.evaluate(()=>window.__finishSelection({x:.1,y:.2,width:.7,height:.5}));await panel.getByRole('alert').waitFor();
  const calls=await page.evaluate(()=>window.__recordingCalls);assert.deepEqual(calls.find(c=>c?.action==='start').region,{x:.1,y:.2,width:.7,height:.5});
  await panel.getByRole('button',{name:'Pantalla completa',exact:true}).click();
  const selectsBefore=calls.filter(c=>c?.action==='select-region').length;await start.click();await panel.getByRole('alert').waitFor();
  const final=await page.evaluate(()=>window.__recordingCalls);assert.equal(final.filter(c=>c?.action==='select-region').length,selectsBefore);assert.equal(final.filter(c=>c?.action==='start').at(-1).region,undefined);
  await page.setViewportSize({width:750,height:520});const startBox=await start.boundingBox();assert.ok(startBox.y+startBox.height<=520,'Start stays visible on small windows');
  const selector=await browser.newPage({viewport:{width:1000,height:700}});selector.on('pageerror',error=>errors.push(String(error)));
  const reset=async()=>{await selector.goto('about:blank');await selector.evaluate(()=>{window.__results=[];window.sykaRegion={complete:r=>window.__results.push(r),cancel:()=>window.__results.push(null)}});await selector.setContent(screenRegionHtml(2000,1400));};
  await reset();await selector.mouse.move(100,200);await selector.mouse.down();await selector.mouse.move(800,550);await selector.screenshot({path:output+'/desktop-selection.png'});await selector.mouse.up();
  let results=await selector.evaluate(()=>window.__results);assert.equal(results.length,1);for(const [key,expected] of Object.entries({x:.1,y:200/700,width:.7,height:.5}))assert.ok(Math.abs(results[0][key]-expected)<1e-9);
  await selector.mouse.move(900,600);await selector.mouse.down();await selector.mouse.up();assert.deepEqual(await selector.evaluate(()=>window.__results),results,'Release commits once and ends the gesture');
  await reset();await selector.mouse.move(800,550);await selector.mouse.down();await selector.mouse.move(100,200);await selector.mouse.up();assert.deepEqual(await selector.evaluate(()=>window.__results),results,'Reverse drag uses the same normalized region');
  await reset();await selector.mouse.move(200,200);await selector.mouse.down();await selector.mouse.move(203,203);await selector.mouse.up();assert.deepEqual(await selector.evaluate(()=>window.__results),[]);await selector.keyboard.press('Escape');assert.deepEqual(await selector.evaluate(()=>window.__results),[null]);
  assert.deepEqual(errors,[]);
  const result={checks:['no thumbnail crop inside setup','start enables desktop selection','modal hidden while choosing','recording waits for selection','cancel does not record','selected physical region reaches recorder','full screen skips selector','footer visible on small windows','reverse drag works','release commits once','tiny region does not commit','Escape cancels'],errors,realCapture:false};
  await writeFile(output+'/verification.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close();}
