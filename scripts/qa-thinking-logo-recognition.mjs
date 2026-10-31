import {chromium} from 'playwright-core';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const output=resolve('output/playwright/thinking-logos');await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:1});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
const entries=[];
try{
  await page.goto('http://127.0.0.1:5197/thinking-logos.html');
  await page.waitForFunction(()=>document.querySelectorAll('.logo-card img').length===110);
  const marks=await page.evaluate(async()=>{const {BRAND_MARKS}=await import('/src/mirel-chat/features/agents/thinking-logos/catalog.ts');return BRAND_MARKS;});
  assert.equal(marks.length,110);
  await page.getByRole('combobox',{name:'Estado de la animación'}).selectOption('working');
  for(const mark of marks){
    await page.getByRole('button',{name:`Ver ${mark.name}`,exact:true}).click();
    await page.locator('.gallery-stage').scrollIntoViewIfNeeded();
    await page.waitForFunction(id=>{
      const host=document.querySelector(`.stage-orb [data-brand="${id}"]`);
      return host?.dataset.moving==='true'&&Number(host.querySelector('canvas')?.dataset.frame)>.22;
    },mark.id);
    const result=await page.evaluate(async id=>{
      const base='/src/mirel-chat/features/agents/thinking-logos/';
      const [{loadMarkAsset,unpackPoints},{markPainter}]=await Promise.all([import(base+'assets.ts'),import(base+'renderer.ts')]);
      const asset=await loadMarkAsset(id);
      const stage=document.querySelector(`.stage-orb [data-brand="${id}"]`);
      const compact=[...document.querySelectorAll(`.actual-sizes [data-brand="${id}"]`)];
      const anchors=compact.filter(host=>host.querySelector('.syka-logo-anchor img')?.naturalWidth>0);
      const compactBounds=anchors.map(host=>{const outer=host.getBoundingClientRect(),image=host.querySelector('.syka-logo-anchor img').getBoundingClientRect();return{size:outer.width,width:image.width,height:image.height,contained:image.left>=outer.left-.5&&image.top>=outer.top-.5&&image.right<=outer.right+.5&&image.bottom<=outer.bottom+.5};});
      const signature=canvas=>{
        const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
        let hash=2166136261,ink=0;
        for(let i=0;i<pixels.length;i++){hash=Math.imul(hash^pixels[i],16777619)>>>0;if(i%4===3&&pixels[i]>12)ink++;}
        return {hash,ink};
      };
      const geometry=[];
      for(const state of ['thinking','searching','working','solving','listening','waiting','generating']){
        for(const size of [20,28,44,64]){
          const canvas=document.createElement('canvas');
          const paint=markPainter(canvas,unpackPoints(size<=32?asset.small:asset.large),state,size,true,'#b7c8de');
          paint(0);const start=signature(canvas);paint(3);const working=signature(canvas);
          geometry.push({state,size,startInk:start.ink,workingInk:working.ink,changed:start.hash!==working.hash});
        }
      }
      return {liveFrame:Number(stage.querySelector('canvas').dataset.frame),moving:stage.dataset.moving==='true',compactAnchors:anchors.length,compactBounds,geometry};
    },mark.id);
    assert(result.moving&&result.liveFrame>.2,`${mark.id}: live animation did not advance`);
    assert.equal(result.compactAnchors,2,`${mark.id}: missing legible compact mark`);
    assert(result.compactBounds.every(image=>image.contained),`${mark.id}: image overflowed the compact icon`);
    assert(result.geometry.every(sample=>sample.changed&&sample.startInk>5&&sample.workingInk>5),`${mark.id}: missing/motionless state`);
    entries.push({id:mark.id,name:mark.name,created:true,liveAnimated:true,compactMode:'stable mark plus moving points at 20–28px',...result});
  }
  // Review sheets contain actual on-screen 20/28/44/64px React marks, not reconstructed thumbnails.
  const sheet=await browser.newPage({viewport:{width:1440,height:1500},deviceScaleFactor:1});
  sheet.on('pageerror',error=>errors.push(error.message));await sheet.goto('http://127.0.0.1:5197/thinking-logos.html');
  for(let start=0;start<marks.length;start+=16){
    const batch=marks.slice(start,start+16);
    await sheet.evaluate(async batch=>{
      const reactModule=await import('/node_modules/.vite/deps/react.js');const React=reactModule.default??reactModule;
      const domModule=await import('/node_modules/.vite/deps/react-dom_client.js');const createRoot=domModule.createRoot??domModule.default?.createRoot;
      const {BrandMark}=await import('/src/mirel-chat/features/agents/thinking-logos/brand-mark.tsx');
      if(window.logoReviewRoot)window.logoReviewRoot.unmount();
      let host=document.getElementById('recognition-review');if(!host){host=document.createElement('main');host.id='recognition-review';document.body.replaceChildren(host);}
      host.style.cssText='padding:24px;background:#111315;color:#eee;font:12px Segoe UI,sans-serif;display:grid;grid-template-columns:repeat(4,1fr);gap:14px';
      window.logoReviewRoot=createRoot(host);
      window.logoReviewRoot.render(React.createElement(React.Fragment,null,...batch.map(mark=>React.createElement('section',{key:mark.id,style:{padding:18,border:'1px solid #34383b',background:'#191c1e',minHeight:188}},
        React.createElement('strong',{style:{display:'block',marginBottom:18,fontWeight:500}},mark.name),
        React.createElement('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}},...[20,28,44,64].map(size=>React.createElement('div',{key:size,style:{display:'flex',flexDirection:'column',alignItems:'center',gap:12}},React.createElement(BrandMark,{id:mark.id,size,active:true,state:'working',theme:'dark'}),React.createElement('small',{style:{fontSize:9,color:'#999'}},`${size}px`))))))));
    },batch);
    await sheet.waitForFunction(()=>document.querySelectorAll('#recognition-review [data-moving=true]').length===document.querySelectorAll('#recognition-review [data-brand]').length&&Number(document.querySelector('#recognition-review canvas')?.dataset.frame)>.28);
    await sheet.locator('#recognition-review').screenshot({path:resolve(output,`recognition-${String(start+1).padStart(3,'0')}-${String(Math.min(start+16,110)).padStart(3,'0')}.png`)});
  }
  await sheet.close();assert.deepEqual(errors,[]);
  await writeFile(resolve(output,'recognition.json'),JSON.stringify({catalogCount:marks.length,created:entries.length,liveAnimated:entries.filter(x=>x.liveAnimated).length,stateSizeChecks:entries.reduce((sum,x)=>sum+x.geometry.length,0),errors,entries},null,2));
  console.log(`Verified ${entries.length} live animated marks, ${entries.length*28} state/size renders and 7 review sheets; no browser errors.`);
}finally{await browser.close();}
