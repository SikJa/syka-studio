// Uses real chat components with synthetic events/files; never opens or edits a user project.
import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const output='output/playwright/image-generation-chat';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const errors=[];
let page;
try {
  page=await browser.newPage({viewport:{width:1100,height:850}});
  page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(String(error)));
  await page.goto('http://localhost:5188');
  await page.evaluate(async()=>{
    const solid=await import('/node_modules/.vite/deps/solid-js.js');
    const solidWeb=await import('/node_modules/.vite/deps/solid-js_web.js');
    // Context providers must come from the same Vite/HMR module generation as the view.
    const imported=(source,path)=>source.match(new RegExp('from ["\']('+path.replaceAll('.','\\.')+'[^"\']*)["\']'))?.[1]??path;
    const transcriptSource=await(await fetch('/src/agent-chat/transcript.tsx')).text();
    const itemsUrl=imported(transcriptSource,'/src/agent-chat/items.tsx');
    const itemSource=await(await fetch(itemsUrl)).text();
    const imageUrl=imported(itemSource,'/src/agent-chat/image-generation-item.tsx');
    const {Transcript}=await import('/src/agent-chat/transcript.tsx');
    const {ChatActionsContext}=await import(imported(itemSource,'/src/agent-chat/mirel-messages.tsx'));
    const {GeneratedImagesContext}=await import(imageUrl);
    const {imagePathsForMessage}=await import('/src/agent-chat/image-message-presentation.ts');
    const {AgentComposer}=await import('/src/mirel-chat/features/agents/agent-composer.tsx');
    const reactModule=await import('/node_modules/.vite/deps/react.js');
    const react=reactModule.default??reactModule;
    const reactDomModule=await import('/node_modules/.vite/deps/react-dom_client.js');
    const reactDom=reactDomModule.default??reactDomModule;
    document.documentElement.dataset.kbTheme='dark';
    const overlay=document.createElement('div');overlay.id='image-fixture';overlay.style.cssText='position:fixed;inset:0;z-index:100;background:var(--background);display:flex;justify-content:center;gap:40px;padding:24px;overflow:auto';document.body.append(overlay);
    const panel=document.createElement('div');panel.className='syka-agent-chat';panel.style.cssText='display:flex;flex-direction:column;width:380px;min-width:380px;height:770px;border:1px solid var(--border);border-radius:16px';overlay.append(panel);
    const composer=document.createElement('div');composer.style.cssText='width:360px';composer.className='syka-mirel-visuals';overlay.append(composer);
    const trace=[{id:'u',kind:'user',text:'Hacé una portada con esta idea.'},
      {id:'progress',kind:'assistant',phase:'commentary',text:'Voy a preparar la portada con una tipografía clara.'},
      {id:'summary',kind:'reasoning',summary:true,text:'Resumen público: comparo el formato y la composición.'},
      {id:'image',kind:'tool',name:'imageGeneration',title:'Generar imagen',status:'running'},
      {id:'private',kind:'reasoning',text:'PRIVATE_REASONING_SENTINEL'}];
    const [items,setItems]=solid.createSignal(trace),[running,setRunning]=solid.createSignal(true),[assets,setAssets]=solid.createSignal(new Map());
    window.__imageInserts=0;window.__objectUrls=[];window.__revokedUrls=[];
    const createUrl=URL.createObjectURL.bind(URL),revokeUrl=URL.revokeObjectURL.bind(URL);
    URL.createObjectURL=blob=>{const url=createUrl(blob);window.__objectUrls.push(url);return url};
    URL.revokeObjectURL=url=>{window.__revokedUrls.push(url);revokeUrl(url)};
    const dispose=solidWeb.render(()=>solid.createComponent(GeneratedImagesContext.Provider,{value:{registration:id=>assets().get(id),insert:()=>window.__imageInserts++},get children(){return solid.createComponent(ChatActionsContext.Provider,{value:{chatKey:()=> 'isolated-image-fixture',running,imageDownloadPaths:id=>imagePathsForMessage(items(),id),lastAssistantId:()=>items().findLast(i=>i.kind==='assistant')?.id,isActiveItem:()=>true,onBranch:()=>{},onDraft:()=>{}},get children(){return solid.createComponent(Transcript,{get items(){return items()},sendCount:0,chatKey:'isolated-image-fixture',get running(){return running()},waiting:false})}})}}),panel);
    const canvas=document.createElement('canvas');canvas.width=960;canvas.height=540;const ctx=canvas.getContext('2d');
    ctx.fillStyle='#1600ff';ctx.fillRect(0,0,960,540);ctx.fillStyle='#f1eee6';ctx.font='bold 106px Arial';ctx.fillText('HACÉ',56,185);ctx.font='bold 58px Arial';ctx.fillText('ESPACIO A TU IDEA.',56,270);
    ctx.font='24px Arial';ctx.fillText('Fixture local · imagen completa 16:9',56,450);
    const blob=await new Promise(done=>canvas.toBlob(done,'image/png'));const file=new File([blob],'preview.png',{type:'image/png'});
    const path='03 Assets reutilizables/Generados/Codex/codex-9df30299-bbcf-4347-8091-093d55fa76cc.png';
    window.__completeImage=()=>{setAssets(new Map([['image',{asset:{id:'fixture-asset',source:path,width:960,height:540,handle:{getFile:async()=>file}}}]]));setItems(trace.map(i=>i.id==='image'?{...i,status:'done',output:JSON.stringify({provider:'Codex subscription',path,absolutePath:'D:/Fixture/'+path,bytes:file.size})}:i));};
    window.__finalImage=()=>{setItems(list=>[...list,{id:'final',kind:'assistant',phase:'final',text:'Listo: la portada quedó guardada en el proyecto.\n[Descargar portada](<D:/Fixture/'+path+'>)'}]);setRunning(false)};
    window.__cancelImage=()=>{setItems(trace);setAssets(new Map());setRunning(false)};
    window.__failImage=()=>{setAssets(new Map());setItems(trace.map(i=>i.id==='image'?{...i,status:'failed',output:'La cuenta alcanzó su límite de imágenes.'}:i));setRunning(false)};
    window.__disposeImage=dispose;
    const composerRoot=reactDom.createRoot(composer);
    const Composer=()=>{const [value,setValue]=react.useState('Mirá esta referencia.');return react.createElement(AgentComposer,{value,onChange:setValue,onSubmit:()=>{},placeholder:'Escribí una idea',ariaLabel:'Borrador de prueba',modelFallbackLabel:'Syka'})};
    composerRoot.render(react.createElement(Composer));
  });
  const image=page.locator('[data-chat-image-item="image"]');
  await image.locator('[data-slot="grid-reveal"]').waitFor();
  await page.getByText('Resumen público: comparo el formato y la composición.').waitFor();
  assert.equal(await page.getByText('PRIVATE_REASONING_SENTINEL').count(),0);
  await page.screenshot({path:output+'/generating.png'});
  await page.evaluate(()=>window.__completeImage());
  await image.locator('.syka-image-generation-preview>img').waitFor();
  await image.getByRole('group',{name:'Acciones de la imagen'}).evaluate(async element=>{
    await Promise.all(element.getAnimations({subtree:true}).map(animation=>animation.finished));
  });
  assert.equal(await image.locator('.syka-image-generation-preview>img').evaluate(el=>el.naturalWidth/el.naturalHeight),16/9);
  await image.getByRole('button',{name:'Agregar al video'}).click();
  assert.equal(await page.evaluate(()=>window.__imageInserts),1);
  const transfer=await page.evaluateHandle(()=>new DataTransfer());
  await image.locator('.syka-image-generation-preview').dispatchEvent('dragstart',{dataTransfer:transfer});
  assert.ok(await transfer.evaluate(data=>data.types.length>0));
  const download=page.waitForEvent('download');await image.getByRole('link',{name:'Descargar imagen generada'}).click();assert.ok((await download).suggestedFilename().endsWith('.png'));
  await image.getByRole('button',{name:'Ampliar imagen generada'}).click();await page.getByRole('dialog',{name:'Previsualización de Imagen generada'}).waitFor();await page.keyboard.press('Escape');
  await image.getByRole('button',{name:'Abrir imagen en grande'}).click();await page.getByRole('dialog',{name:'Previsualización de Imagen generada'}).waitFor();await page.keyboard.press('Escape');
  await page.evaluate(()=>window.__finalImage());
  await image.locator('[data-image-generation="ready"]').waitFor();
  await page.getByText('Listo: la portada quedó guardada en el proyecto.').waitFor();
  assert.equal(await page.getByRole('link',{name:'Descargar portada'}).count(),0);
  assert.equal(await page.getByRole('link',{name:'Descargar imagen generada'}).count(),1);
  const bounds=await image.locator('.syka-image-generation-preview').boundingBox();
  const actions=await image.getByRole('group',{name:'Acciones de la imagen'}).boundingBox();
  assert.ok(Math.abs(actions.x+actions.width/2-bounds.x-bounds.width/2)<1);
  assert.ok(actions.y>=bounds.y+bounds.height-1.5);
  assert.ok(actions.y+actions.height-bounds.y-bounds.height<=30);
  const downloadBounds=await image.getByRole('link',{name:'Descargar imagen generada'}).boundingBox();
  const insertBounds=await image.getByRole('button',{name:'Agregar al video'}).boundingBox();
  const expandBounds=await image.getByRole('button',{name:'Ampliar imagen generada'}).boundingBox();
  assert.equal(insertBounds.y,downloadBounds.y);
  assert.equal(downloadBounds.y,expandBounds.y);
  await page.screenshot({path:output+'/completed.png'});
  // Reproduce the DOM retained by a chat open before the layout changed.
  await image.evaluate(element=>{
    const preview=element.querySelector('.syka-image-generation-preview');
    const actions=element.querySelector('.syka-image-generation-actions');
    actions.querySelector('.syka-image-generation-arc')?.remove();
    preview.append(actions);
  });
  const legacyButton=image.getByRole('button',{name:'Agregar al video'});
  await image.getByRole('group',{name:'Acciones de la imagen'}).evaluate(async element=>{
    await Promise.all(element.getAnimations({subtree:true}).map(animation=>animation.finished));
  });
  assert.ok(await legacyButton.evaluate(element=>{
    const rect=element.getBoundingClientRect();
    return element.contains(document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2));
  }));
  await legacyButton.click();
  assert.equal(await page.evaluate(()=>window.__imageInserts),2);
  await page.screenshot({path:output+'/already-open-chat.png'});
  await image.evaluate(element=>element.querySelector('.syka-image-generation-actions-space').append(element.querySelector('.syka-image-generation-actions')));
  const input=page.getByRole('textbox',{name:'Borrador de prueba'});
  await input.fill('Mirá esta referencia.\nhttps://x.com/example/status/123?s=46');
  await input.blur();await page.locator('.syka-composer-web-links [data-platform="x"]').waitFor();
  assert.equal(await input.inputValue(),'Mirá esta referencia.');
  await input.fill('Mirá esta referencia.\nhttps://www.youtube.com/watch?v=123');await input.blur();
  assert.equal(await page.locator('.syka-composer-web-links .syka-web-link-chip').count(),2);
  await input.focus();
  await input.evaluate(el=>{const data=new DataTransfer();data.setData('text/plain','\nhttps://www.instagram.com/p/test/');el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}))});
  assert.equal(await page.locator('.syka-composer-web-links .syka-web-link-chip').count(),3);
  await page.screenshot({path:output+'/links-after-text.png'});
  await page.evaluate(()=>window.__cancelImage());await image.getByText('Generación interrumpida',{exact:true}).first().waitFor();assert.equal(await image.locator('canvas').count(),0);
  await page.evaluate(()=>window.__failImage());await image.getByRole('alert').waitFor();assert.equal(await image.locator('canvas').count(),0);
  await page.evaluate(()=>window.__disposeImage());
  const urls=await page.evaluate(()=>({created:window.__objectUrls,revoked:window.__revokedUrls}));assert.ok(urls.created.every(url=>urls.revoked.includes(url)));
  assert.deepEqual(errors,[]);
  const result={checks:['native event renders grid at its conversation position','public progress and summary retained','private text excluded','complete image is uncropped','asset insertion works','asset drag works','image downloads','lightbox opens and Esc closes','completed image remains after final','duplicate download is suppressed','short curved base and centered aligned controls below image','already-open chat toolbar stays visible and clickable','new URL below prose gets X identity','new edits preserve earlier URLs','later paste adds another link','cancel stops grid','failure stops grid','object URLs released'],errors,realGeneration:false};
  await writeFile(output+'/verification.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
} catch(error) {
  await page?.screenshot({path:output+'/failure.png'}).catch(()=>{});
  const layout=await page?.locator('[data-chat-image-item]').evaluate(element=>{
    const selectors=['.syka-image-generation','.syka-image-generation-preview','.syka-image-generation-actions','button[aria-label="Agregar al video"]'];
    return selectors.map(selector=>{const node=element.querySelector(selector);if(!node)return {selector};const rect=node.getBoundingClientRect(),style=getComputedStyle(node);return {selector,rect:rect.toJSON(),overflow:style.overflow,marginBottom:style.marginBottom,height:style.height,transform:style.transform,atCenter:document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2)?.outerHTML.slice(0,180)}});
  }).catch(()=>[]);
  console.error(JSON.stringify({errors,layout}));throw error;
} finally {await browser.close();}
