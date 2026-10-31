// Independent browser fixture. Never opens or edits a user's project.
import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const output = 'output/playwright/html-text-picker';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--enable-blink-features=CanvasDrawElement', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 780 } });
  page.on('pageerror', error => console.error('Picker QA:', String(error)));
  page.setDefaultTimeout(12000);
  await page.goto('http://localhost:5188');
  const base = '/@fs/' + resolve('.').replaceAll('\\', '/').split('/').map(encodeURIComponent).join('/').replace(/^([A-Za-z])%3A/, '$1:');
  const result = await page.evaluate(async ({ base }) => {
    const runtime = await import(base + '/packages/runtime/src/index.ts');
    const reconciler = await import(base + '/packages/reconciler/src/index.ts');
    const jsx = await import(base + '/packages/jsx/src/index.ts');
    const picker = await import('/src/agent-chat/html-visual-target.ts');
    const native = await import('/src/agent-chat/visual-target-model.ts');
    const solid = await import('/node_modules/.vite/deps/solid-js.js'), solidWeb = await import('/node_modules/.vite/deps/solid-js_web.js');
    const pickerSource = await (await fetch('/src/components/canvas/visual-target-picker.tsx')).text();
    const imported = path => pickerSource.match(new RegExp('from "(' + path.replaceAll('.', '\\.') + '[^"]*)"'))?.[1] ?? path;
    const { EngineProvider, useEngineContext } = await import(imported('/src/engine/context.tsx'));
    const { ProjectProvider } = await import(imported('/src/context/project.tsx'));
    const { VisualTargetPicker } = await import('/src/components/canvas/visual-target-picker.tsx');
    const visualState = await import(imported('/src/agent-chat/visual-target-state.ts'));
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:#141414;z-index:90;display:grid;place-items:center';
    document.body.append(overlay);
    const area = document.createElement('div'); area.style.cssText = 'position:relative;width:720px;height:486px'; overlay.append(area);
    const canvas = document.createElement('canvas'); canvas.width = 800; canvas.height = 540; canvas.style.cssText = 'width:100%;height:100%'; area.append(canvas);
    const pickerMount = document.createElement('div'); pickerMount.style.display = 'contents'; area.append(pickerMount);
    let engine;
    const Fixture = () => { engine = useEngineContext(); engine.mount(canvas); return solid.createComponent(VisualTargetPicker, {}); };
    solidWeb.render(() => solid.createComponent(ProjectProvider, { project: { id: 'isolated-html-target-qa', dir: 'isolated-fixture', displayName: 'Isolated picker fixture' },
      get children() { return solid.createComponent(EngineProvider, { projectId: 'isolated-html-target-qa', get children() { return solid.createComponent(Fixture, {}); } }); } }), pickerMount);
    const world = engine.world;
    const doc = reconciler.createRuntimeDocument(world), scene = doc.createElement('Scene'), owner = doc.createElement('Html');
    for (const [key, value] of Object.entries({ width: 800, height: 540 })) doc.setProperty(scene, key, value);
    doc.insertNode(doc.stage, scene);
    runtime.setActive(world, scene.entity);
    for (const [key, value] of Object.entries({ [jsx.SOURCE_ATTR]: 'fixture.tsx:graphic', width: 580, height: 340, x: 90, y: 100 })) doc.setProperty(owner, key, value);
    doc.insertNode(scene, owner); owner.entity.set(runtime.Computed, { visibility: 1 }); scene.entity.set(runtime.Computed, { visibility: 1 });
    const root = owner.element; root.style.width = '580px'; root.style.height = '340px'; root.style.background = '#0579d1';
    const make = (tag, source, style, text, parent = owner) => {
      const node = doc.createElement(tag);
      doc.setProperty(node, jsx.SOURCE_ATTR, 'fixture.tsx:' + source); doc.setProperty(node, 'style', style);
      doc.insertNode(parent, node); doc.insertNode(node, doc.createTextNode(text)); return node;
    };
    const heading = make('h1', 'heading-one', { position: 'absolute', left: '40px', top: '70px', margin: '0', font: '700 60px Arial', color: 'white' }, 'HACÉ');
    const second = make('h1', 'heading-two', { position: 'absolute', left: '320px', top: '190px', margin: '0', font: '700 45px Arial', color: 'white' }, 'HACÉ');
    const clip = doc.createElement('div'); doc.setProperty(clip, 'style', { position: 'absolute', left: '10px', top: '10px', width: '10px', height: '10px', overflow: 'hidden' }); doc.insertNode(owner, clip);
    const clipped = make('span', 'clipped', { position: 'absolute', left: '30px', top: '0', font: '20px Arial' }, 'CLIPPED', clip);
    await document.fonts.ready;
    const at = node => {
      const range = document.createRange(); range.selectNodeContents(node.element); const rect = range.getBoundingClientRect(), origin = root.getBoundingClientRect();
      return runtime.transformPoint(runtime.entityWorldMat(world, owner.entity), rect.x - origin.x + rect.width / 2, rect.y - origin.y + rect.height / 2);
    };
    runtime.resetCamera(world); runtime.transformSystem(world);
    const firstPoint = at(heading), first = picker.pickHtmlTarget(world, owner.entity, firstPoint);
    const other = picker.pickHtmlTarget(world, owner.entity, at(second));
    if (!first || first.text !== 'HACÉ' || first.source !== 'fixture.tsx:heading-one') throw Error('No precise source for first heading');
    if (!other || other.selector === first.selector || other.source !== 'fixture.tsx:heading-two') throw Error('Repeated text is ambiguous');
    if (first.box.width >= 300 || first.box.height >= 150) throw Error('Selected whole graphic instead of text');
    if (native.pickNativeTarget(world, scene.entity, firstPoint) !== owner.entity) throw Error('Native owner mismatch');
    if (picker.pickHtmlTarget(world, owner.entity, at(clipped))?.text === 'CLIPPED') throw Error('Clipped text still selectable');
    heading.element.style.opacity = '0';
    if (picker.pickHtmlTarget(world, owner.entity, firstPoint)?.source === first.source) throw Error('Invisible text still selectable');
    heading.element.style.opacity = '1';
    doc.setProperty(owner, 'rotation', 13); doc.setProperty(owner, 'scale', 0.8); runtime.transformSystem(world);
    const rotated = picker.pickHtmlTarget(world, owner.entity, at(heading));
    if (!rotated || rotated.source !== first.source) throw Error('Rotation/scale broke mapping');
    runtime.setCameraMatrix(world, [.5, 0, 0, .5, 30, 20]); runtime.transformSystem(world);
    if (picker.pickHtmlTarget(world, owner.entity, at(heading))?.source !== first.source) throw Error('Camera zoom broke mapping');
    runtime.resetCamera(world);
    doc.setProperty(owner, 'rotation', 0); doc.setProperty(owner, 'scale', 1); runtime.transformSystem(world);
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#141414'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const m = runtime.entityWorldMat(world, owner.entity); ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
    if (typeof ctx.drawElementImage !== 'function') throw Error('Browser lacks canvas DOM rendering capability');
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    ctx.drawElementImage(root, 0, 0, 580, 340); ctx.resetTransform();
    const box = first.box; ctx.strokeStyle = '#ff5555'; ctx.lineWidth = 2; ctx.strokeRect(box.x - 4, box.y - 4, box.width + 8, box.height + 8);
    const label = document.createElement('p'); label.textContent = 'Texto “HACÉ” · solamente heading-one · fixture aislada'; label.style.cssText = 'position:absolute;bottom:60px;color:white;font:16px Arial'; overlay.append(label);
    window.__pickerQA = { engine, world, owner, heading, second, root, at, canvas, setVisualPickMode: visualState.setVisualPickMode, handleShortcut: visualState.handleVisualSelectShortcut };
    engine.start();
    return { first: picker.htmlTargetDetails(first), other: picker.htmlTargetDetails(other), box, rotatedBox: rotated.box,
      checks: ['exact DOM child Source', 'duplicate labels', 'native owner retained', 'clipping', 'hidden text', 'rotated/scaled native geometry', 'canvas DOM render at reduced preview size'] };
  }, { base });
  await page.screenshot({ path: output + '/selection.png' });
  const clickPoint = await page.evaluate(async () => {
    window.__pickerQA.setVisualPickMode('element');
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const fixture = window.__pickerQA, point = fixture.at(fixture.heading), rect = fixture.canvas.getBoundingClientRect();
    return { x: rect.x + point.x * rect.width / fixture.canvas.width, y: rect.y + point.y * rect.height / fixture.canvas.height };
  });
  await page.mouse.move(clickPoint.x, clickPoint.y);
  const tutorial=page.getByRole('dialog',{name:'Cómo seleccionar componentes'});
  await tutorial.waitFor();
  await page.screenshot({path:output+'/first-use-tutorial.png'});
  await tutorial.getByRole('button',{name:'Entendido, seleccionar'}).click();
  await page.mouse.move(clickPoint.x+2,clickPoint.y);
  try { await page.locator('.syka-visual-target-outline>span').filter({ hasText: 'HACÉ' }).waitFor(); }
  catch(error) { await page.screenshot({path:output+'/failure.png'});console.error(await page.evaluate(({x,y})=>({layers:document.elementsFromPoint(x,y).map(el=>({tag:el.tagName,class:el.className})),picker:document.querySelector('.syka-visual-picker')?.outerHTML,rect:window.__pickerQA.canvas.getBoundingClientRect().toJSON(),point:window.__pickerQA.at(window.__pickerQA.heading)}),clickPoint));throw error; }
  await page.mouse.click(clickPoint.x, clickPoint.y);
  const card = page.getByRole('dialog', { name: 'Referencia visual para el agente' });
  await card.waitFor();
  if ((await card.locator('.syka-visual-target-heading strong').textContent()) !== 'Texto “HACÉ”') throw Error('Picker locked whole component');
  await card.getByRole('checkbox', { name: 'Incluir captura' }).uncheck();
  await card.getByRole('textbox', { name: 'Qué mejorar de esta referencia' }).fill('Poné solamente este texto en amarillo');
  await page.screenshot({ path: output + '/picker-note.png' });
  await card.getByRole('button', { name: 'Añadir a revisión', exact: true }).click();
  await card.waitFor({ state: 'hidden' });
  const note = await page.evaluate(async () => {
    const { readVisualNotes } = await import('/src/agent-chat/visual-review-storage.ts');
    return (await readVisualNotes('new:isolated-html-target-qa'))[0];
  });
  if (note?.context?.elements?.[0]?.subtarget?.source !== 'fixture.tsx:heading-one' || note.context.kind !== 'html-text') throw Error('Precise target lost while saving note: ' + JSON.stringify(note));
  result.savedNote = { title: note.title, instruction: note.instruction, context: note.context };
  result.checks.push('real picker hover/click', 'native note composer', 'precise target saved to chat review');
  // The same shortcut handler used by Canvas, including focused-composer input.
  await page.evaluate(() => {
    document.addEventListener('keydown', window.__pickerQA.handleShortcut, true);
    const input=document.createElement('textarea');input.id='shortcut-focus';input.style.cssText='position:fixed;left:12px;top:12px';document.body.append(input);input.focus();
  });
  await page.keyboard.press('Control+Shift+S');
  await page.getByRole('region',{name:'Señalar componente editable'}).waitFor();
  await page.keyboard.press('Control+Shift+S');
  await page.getByRole('region',{name:'Señalar componente editable'}).waitFor({state:'detached'});
  await page.keyboard.press('Control+Shift+S');
  const secondPoint=await page.evaluate(()=>{const q=window.__pickerQA,p=q.at(q.second),r=q.canvas.getBoundingClientRect();return{x:r.x+p.x*r.width/q.canvas.width,y:r.y+p.y*r.height/q.canvas.height};});
  await page.mouse.click(secondPoint.x,secondPoint.y);
  await card.waitFor();
  await page.waitForFunction(()=>!document.querySelector('button[aria-label="Sumar otro componente"]')?.disabled);
  await page.keyboard.down('Control');
  await card.waitFor({state:'detached'});
  await page.mouse.click(clickPoint.x,clickPoint.y);
  assert.equal(await card.count(),0,'No note dialog while Ctrl is held');
  assert.equal(await page.locator('.syka-visual-selected-outline').count(),2);
  // Ctrl+click a member toggles it, without leaving the selection workflow.
  await page.mouse.click(clickPoint.x,clickPoint.y);
  assert.equal(await page.locator('.syka-visual-selected-outline').count(),1);
  await page.mouse.click(clickPoint.x,clickPoint.y);
  await page.screenshot({path:output+'/ctrl-collection.png'});
  await page.keyboard.up('Control');
  await page.waitForFunction(()=>document.querySelector('.syka-visual-target-heading strong')?.textContent==='2 componentes');
  assert.equal(await page.locator('.syka-visual-selected-outline').count(),2);
  await page.waitForFunction(()=>!document.querySelector('button[aria-label="Sumar otro componente"]')?.disabled);
  await card.getByRole('button',{name:'Quitar Texto “HACÉ”'}).first().click();
  await page.waitForFunction(()=>document.querySelectorAll('.syka-visual-selected-outline').length===1);
  await card.getByRole('button',{name:'Sumar otro componente'}).click();
  await card.waitFor({state:'detached'});
  await page.mouse.click(secondPoint.x,secondPoint.y);
  await card.waitFor();
  await page.waitForFunction(()=>document.querySelector('.syka-visual-target-heading strong')?.textContent==='2 componentes');
  // Exercise real attachment preparation without the user's desktop or files.
  await page.evaluate(async({base})=>{
    const {MAIN_CHANNELS,MAIN_WIRE}=await import(base+'/apps/desktop/src/main-channels.ts');
    const listeners=new Map(),writes=new Map(),files=[];window.__qaFiles=files;
    window.desktop={getPathForFile:()=>'',on:(channel,listener)=>{listeners.set(channel,listener);return()=>listeners.delete(channel)},send:(channel,request)=>{
      queueMicrotask(()=>{let data;
        try{
          if(request.channel===MAIN_CHANNELS.FILE_WRITE_OPEN){const id=crypto.randomUUID();writes.set(id,{path:request.data.path,chunks:[]});data={id}}
          else if(request.channel===MAIN_CHANNELS.FILE_WRITE_CHUNK){writes.get(request.data.id).chunks.push(request.data.data)}
          else if(request.channel===MAIN_CHANNELS.FILE_WRITE_CLOSE){files.push(writes.get(request.data.id));writes.delete(request.data.id)}
          else if(request.channel===MAIN_CHANNELS.FILE_WRITE_ABORT){writes.delete(request.data.id)}
          else throw Error('Unexpected fixture IPC '+request.channel);
          listeners.get(MAIN_WIRE.RESPONSE)?.({id:request.id,ok:true,data});
        }catch(error){listeners.get(MAIN_WIRE.RESPONSE)?.({id:request.id,ok:false,error:String(error)})}
      });
    }};
  },{base});
  await card.getByRole('checkbox',{name:'Incluir captura'}).check();
  assert.equal(await card.getByRole('textbox',{name:'Qué mejorar de esta referencia'}).inputValue(),'');
  assert.ok((await card.boundingBox()).width<=300);
  await page.evaluate(()=>{window.__pickerQA.heading.element.textContent='CAMBIÓ'});
  await card.getByRole('button',{name:'Añadir a revisión',exact:true}).click();
  await card.getByRole('alert').filter({hasText:'La escena o el componente cambió'}).waitFor();
  assert.equal(await page.evaluate(()=>window.__qaFiles.length),0);
  await page.evaluate(()=>{window.__pickerQA.heading.element.textContent='HACÉ'});
  await page.screenshot({path:output+'/multiple-components.png'});
  await card.getByRole('button',{name:'Añadir a revisión',exact:true}).click();
  await card.waitFor({state:'detached'});
  const capture=await page.evaluate(async()=>{
    const {readVisualNotes}=await import('/src/agent-chat/visual-review-storage.ts');return(await readVisualNotes('new:isolated-html-target-qa'))[1];
  });
  assert.equal(capture.instruction,'');assert.equal(capture.context.kind,'editable-elements');assert.equal(capture.attachments.length,1);
  assert.deepEqual(capture.context.elements.map(item=>item.subtarget.source).sort(),['fixture.tsx:heading-one','fixture.tsx:heading-two']);
  assert.notEqual(capture.context.elements[0].subtarget.selector,capture.context.elements[1].subtarget.selector);
  // Mount the actual tray and React composer. Both send the collected notes
  // through the same callback, with a generated review manifest, without text.
  await page.evaluate(async()=>{
    const solid=await import('/node_modules/.vite/deps/solid-js.js'),web=await import('/node_modules/.vite/deps/solid-js_web.js');
    const reactModule=await import('/node_modules/.vite/deps/react.js'),domModule=await import('/node_modules/.vite/deps/react-dom_client.js');
    const react=reactModule.default??reactModule,dom=domModule.default??domModule;
    const {AgentComposer}=await import('/src/mirel-chat/features/agents/agent-composer.tsx');
    const {VisualReviewTray}=await import('/src/agent-chat/visual-review-tray.tsx');
    const {visualNotes,loadVisualNotes}=await import('/src/agent-chat/visual-review-state.ts');
    const {prepareVisualReview}=await import('/src/agent-chat/prepare-visual-review.ts');
    const mount=document.createElement('div');mount.className='syka-agent-chat';mount.style.cssText='position:fixed;bottom:16px;left:16px;width:320px;z-index:200;background:#171717;padding:10px;border-radius:12px';document.body.append(mount);
    const key='new:isolated-html-target-qa';window.__qaSends=[];
    const send=async()=>{await loadVisualNotes(key);window.__qaSends.push(await prepareVisualReview('',[],visualNotes(key),'isolated-fixture'))};
    const tray=document.createElement('div');mount.append(tray);web.render(()=>solid.createComponent(VisualReviewTray,{chatKey:key,disabled:false,submitting:false,onSend:()=>void send()}),tray);
    const composer=document.createElement('div');mount.append(composer);dom.createRoot(composer).render(react.createElement(AgentComposer,{value:'',onChange:()=>{},onSubmit:()=>void send(),placeholder:'Mensaje',hasContext:true,submitLabel:'Enviar captura sola',voice:{enabled:false}}));
  });
  await page.getByRole('button',{name:'Enviar notas',exact:false}).click();
  await page.waitForFunction(()=>window.__qaSends.length===1);
  await page.getByRole('button',{name:'Enviar captura sola',exact:true}).click();
  await page.waitForFunction(()=>window.__qaSends.length===2);
  const handoff=await page.evaluate(()=>({sends:window.__qaSends.map(send=>({text:send.text,attachments:send.attachments.map(item=>({name:item.name,purpose:item.purpose}))})),files:window.__qaFiles.map(file=>({path:file.path,size:file.chunks.reduce((n,c)=>n+c.length,0)}))}));
  assert.ok(handoff.sends.every(send=>send.text.includes('Correcciones visuales (2)')&&send.attachments.some(item=>item.purpose==='visual-review-context')),JSON.stringify(handoff));
  assert.ok(handoff.files.some(file=>file.path.endsWith('.png')&&file.size>0));
  result.multipleCapture={title:capture.title,instruction:capture.instruction,elements:capture.context.elements};result.handoff=handoff;
  // Seek must remove stale boxes but leave saved chat notes available.
  await page.evaluate(()=>window.__pickerQA.setVisualPickMode('element'));
  await page.mouse.click(clickPoint.x,clickPoint.y);await card.waitFor();
  await page.evaluate(async({base})=>{const q=window.__pickerQA,r=await import(base+'/packages/runtime/src/index.ts');r.setPlayhead(q.world,r.getActiveEntity(q.world),12);}, {base});
  await card.waitFor({state:'detached'});
  assert.equal(await page.locator('.syka-visual-selected-outline').count(),0);
  assert.equal(await page.locator('.syka-visual-review textarea').count(),2);
  result.checks.push('first-use tutorial','tutorial not repeated','shortcut from focused textarea','shortcut toggles off','Ctrl+click collection without intermediate dialog','Ctrl toggle member','release opens joint note','individual tight outlines','remove one target','add another without modifier','reject stale multi-component references','seek clears frozen outlines','saved notes survive seek','capture without instruction','compact 300px reference card','tray sends directly','empty composer sends visual context');
  await page.screenshot({path:output+'/review-tray.png'});
  await writeFile(output + '/verification.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); }
