import {chromium} from 'playwright-core';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const url=process.env.SYKA_LOGO_PREVIEW_URL??'http://127.0.0.1:5197/thinking-logos.html';
const output=resolve('output/playwright/thinking-logos');await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:1});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
const checks=[];
try {
  await page.goto(url);await page.getByRole('heading',{name:'Cada herramienta, a su ritmo.'}).waitFor();
  await page.waitForFunction(()=>document.querySelectorAll('.logo-card img').length===110);
  assert.equal(await page.locator('.logo-card').count(),110);checks.push('110 real catalog cards loaded');
  await writeFile(resolve(output,'initial-accessibility.txt'),await page.locator('body').ariaSnapshot());
  await page.waitForFunction(()=>Number(document.querySelector('.stage-orb canvas')?.dataset.frame)>.1);
  await page.screenshot({path:resolve(output,'gallery-dark.png')});
  await page.getByRole('button',{name:'Las 40 nuevas'}).click();assert.equal(await page.locator('.logo-card').count(),40);
  await page.getByRole('button',{name:'Las 40 nuevas'}).click();
  await page.getByRole('searchbox',{name:'Buscar aplicación'}).fill('YouTube');assert.equal(await page.locator('.logo-card').count(),1);
  await page.getByRole('button',{name:'Ver YouTube',exact:true}).click();
  await page.getByRole('searchbox',{name:'Buscar aplicación'}).fill('');checks.push('new-only and search filters');
  for(const state of ['thinking','searching','working','solving','listening','waiting','generating']) {
    await page.getByRole('combobox',{name:'Estado de la animación'}).selectOption(state);
    await page.waitForFunction(()=>Number(document.querySelector('.stage-orb canvas')?.dataset.frame)>.12);
    await page.locator('.gallery-stage').screenshot({path:resolve(output,`state-${state}.png`)});
  }
  checks.push('all seven upstream states animate');
  await page.getByRole('button',{name:'Pausar',exact:true}).click();
  assert.equal(await page.locator('.stage-orb [data-moving=true]').count(),0);
  await page.getByRole('button',{name:'Reproducir',exact:true}).click();
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(()=>document.querySelectorAll('[data-moving=true]').length===0);
  await page.screenshot({path:resolve(output,'gallery-reduced-motion.png')});
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(()=>document.documentElement.dataset.sykaMotion='reduced');
  await page.waitForFunction(()=>document.querySelectorAll('[data-moving=true]').length===0);
  await page.evaluate(()=>delete document.documentElement.dataset.sykaMotion);checks.push('pause and OS/app reduced motion');
  await page.getByRole('button',{name:'Error',exact:true}).click();assert.equal(await page.locator('.activity-example [data-failed=true]').count(),1);
  assert.equal(await page.locator('.activity-example [data-moving=true]').count(),0);
  await page.getByRole('button',{name:'Completada',exact:true}).click();assert.equal(await page.locator('.activity-example [data-failed=true]').count(),0);
  await page.getByRole('button',{name:'En curso',exact:true}).click();checks.push('completed and failed tools stop with truthful status');
  await page.getByRole('button',{name:'Modo claro'}).click();await page.screenshot({path:resolve(output,'gallery-light.png')});
  await page.getByRole('button',{name:'Modo oscuro'}).click();
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:resolve(output,'gallery-mobile.png')});checks.push('light/dark themes and 390px layout');
  await page.setViewportSize({width:1440,height:1100});
  await page.locator('.gallery-footer').scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>document.querySelector('.stage-orb [data-moving]')?.dataset.moving==='false');
  checks.push('offscreen animation suspension');
  // All original marks versus assembled point sets, using the same renderer as the chat.
  const contact=await browser.newPage({viewport:{width:1440,height:1200},deviceScaleFactor:1});
  contact.on('pageerror',error=>errors.push(error.message));await contact.goto(url);
  const geometry=await contact.evaluate(async()=>{
    const base='/src/mirel-chat/features/agents/thinking-logos/';
    const [{BRAND_MARKS},{loadMarkAsset,unpackPoints},{markPainter}]=await Promise.all([import(base+'catalog.ts'),import(base+'assets.ts'),import(base+'renderer.ts')]);
    document.body.innerHTML='<main id="contact" style="background:#111315;color:#eee;font:12px Segoe UI;padding:20px;display:grid;grid-template-columns:repeat(8,1fr);gap:10px"></main>';
    const stats=[];
    for(const mark of BRAND_MARKS){
      const asset=await loadMarkAsset(mark.id);const card=document.createElement('section');card.style.cssText='background:#1a1d1f;border:1px solid #34383b;padding:10px;min-height:145px';
      const label=document.createElement('div');label.textContent=mark.name;label.style.cssText='height:28px;font-size:11px';card.append(label);
      const images=document.createElement('div');images.style.cssText='display:flex;align-items:center;gap:7px';card.append(images);
      const original=new Image();original.src=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(asset.monochrome?asset.markSvg:asset.svg)}`;original.style.cssText='width:44px;height:44px;object-fit:contain';if(asset.monochrome)original.style.filter='brightness(0) invert(.85)';images.append(original);await original.decode();
      const canvas=document.createElement('canvas');canvas.style.cssText='width:64px;height:64px';images.append(canvas);markPainter(canvas,unpackPoints(asset.large),'thinking',64,true,mark.tint)(0);
      const small=document.createElement('canvas');small.style.cssText='width:26px;height:26px';card.append(small);markPainter(small,unpackPoints(asset.small),'thinking',26,true,mark.tint)(0);
      document.querySelector('#contact').append(card);
      const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
      let ink=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>10)ink++;
      stats.push({id:mark.id,ink,small:asset.small.n,large:asset.large.n});
    }return stats;
  });
  assert(geometry.every(mark=>mark.ink>15));await contact.screenshot({path:resolve(output,'all-110-marks.png'),fullPage:true});
  await contact.close();checks.push('110 assembled marks render with nonempty pixels at two densities');
  // Render the actual chat trace with synthetic tool events; no provider or account is called.
  await page.setViewportSize({width:900,height:500});
  await page.evaluate(async()=>{
    const [solidModule,solidDomModule,{MirelTrace}]=await Promise.all([import('/node_modules/.vite/deps/solid-js.js'),import('/node_modules/.vite/deps/solid-js_web.js'),import('/src/agent-chat/mirel-messages.tsx')]);
    const createSignal=solidModule.createSignal??solidModule.default?.createSignal;
    const render=solidDomModule.render??solidDomModule.default?.render;
    if(typeof render!=='function')throw Error('Solid DOM did not export render');
    await import('/src/mirel-chat/features/agents/agent-workspace.css');
    const host=document.createElement('div');host.id='trace-fixture';host.className='syka-mirel-visuals';host.style.cssText='position:fixed;inset:0;padding:60px;background:#16191b;color:#ddd;font:13px Segoe UI,sans-serif;--muted:#aaa;--muted-2:#999;--text:#ddd;--text-soft:#ddd;--surface-hover:#222;z-index:100';host.dataset.kbTheme='dark';document.body.append(host);
    const [item,setItem]=createSignal({id:'fixture-x',kind:'tool',status:'running',name:'mcp__agent_reach__browse',title:'Navegando en X',detail:'https://x.com/example'});
    render(()=>MirelTrace({get item(){return item();}}),host);
    window.renderLogoTrace=state=>setItem({...item(),status:state==='started'?'running':state==='completed'?'done':'failed'});
  });
  await page.locator('#trace-fixture [data-brand=x]').waitFor();await page.waitForFunction(()=>document.querySelector('#trace-fixture [data-brand=x]')?.dataset.moving==='true');
  await page.screenshot({path:resolve(output,'chat-tool-running.png')});
  await page.evaluate(()=>window.renderLogoTrace('completed'));await page.locator('#trace-fixture .agent-tool-summary-header').click();
  await page.locator('#trace-fixture [data-brand=x]').waitFor();assert.equal(await page.locator('#trace-fixture [data-moving=true]').count(),0);
  await page.evaluate(()=>window.renderLogoTrace('failed'));await page.locator('#trace-fixture [data-failed=true]').waitFor();
  await page.screenshot({path:resolve(output,'chat-tool-failed.png')});checks.push('actual Solid→React chat bridge: Agent Reach → X, running/done/failed (fixture)');
  assert.deepEqual(errors,[]);await writeFile(resolve(output,'verification.json'),JSON.stringify({url,checks,errors,geometry},null,2));
  console.log(JSON.stringify({checks,errors,output},null,2));
} finally {await browser.close();}
