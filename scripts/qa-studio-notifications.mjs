// Isolated native app, actual main/preload/UI/IPC and fake provider only in this QA bundle.
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { mkdir, writeFile, readFile, copyFile, cp } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
async function freePort() { const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port;await new Promise(resolve=>server.close(resolve));return port; }
const cdpPort=await freePort(), mcpPort=await freePort();
const require = createRequire(import.meta.url), root = resolve('.');
const qa = join(root, '.runtime/notification-qa-20261010'), appDir = join(qa, 'desktop'), runtime = join(qa, 'runtime-' + Date.now());
const output = join(root, 'output/question-notification-20261010/native-evidence');
const nativeStateFile = join(runtime, 'native-state.json');
await Promise.all([join(appDir, 'dist'), join(appDir, 'syka-assets'), runtime, output].map(dir => mkdir(dir, { recursive: true })));
await writeFile(join(appDir, 'package.json'), JSON.stringify({ name: 'syka-notification-qa', version: '0.207.0', main: 'dist/main.js' }));
await copyFile(join(root, 'apps/desktop/syka-assets/icon.png'), join(appDir, 'syka-assets/icon.png'));
await cp(join(root, 'apps/desktop/web'), join(appDir, 'web'), {recursive:true});
// Packaged HTML/asset paths, but compiler dependencies resolve from this repo:
// the isolated QA app has no staged installer Resources/runtime directory.
// Keep only this fixture's notification window off-screen. Physical desktop
// mouse movement must not race CDP hover/collapse assertions during user work.
await build({ entryPoints: [join(root, 'apps/desktop/src/main.ts')], outfile: join(appDir, 'dist/main.js'), bundle: true, platform: 'node', format: 'cjs', banner:{js:"process.on('uncaughtException',e=>{console.error('QA MAIN ERROR',e.stack);process.exit(1)});console.error('QA main loaded');"}, external: ['electron', 'esbuild', '@babel/core', '@babel/preset-typescript', 'babel-preset-solid'], plugins: [{name:'qa-native-state', setup(b){b.onLoad({filter:/desktop[\\/]src[\\/]notifications\.ts$/},async({path})=>({loader:'ts',contents:(await readFile(path,'utf8')).replace('const work = display.workArea;', 'const work = { ...display.workArea, x: -6000 };')}));b.onLoad({filter:/desktop[\\/]src[\\/]projects\.ts$/},async({path})=>({loader:'ts',contents:(await readFile(path,'utf8')).replace('if (!isPackagedBuild()) return require(name) as T;', 'return require(name) as T;')}));b.onLoad({filter:/desktop[\\/]src[\\/]app-mode\.ts$/},async()=>({loader:'ts',contents:'export function isPackagedBuild(){return true;}'}));b.onLoad({filter:/desktop[\\/]src[\\/]main\.ts$/},async({path})=>({loader:'ts',contents:(await readFile(path,'utf8')) + `\nmainBridge.handle(MAIN_CHANNELS.SYKA_GROQ_STATUS,()=>({configured:true}));mainBridge.handle(MAIN_CHANNELS.SYKA_GROQ_TRANSCRIBE,()=>[{text:'Respuesta por voz',words:[{text:'Respuesta',start:0,end:.5},{text:'por voz',start:.5,end:1}]}]);\nsetInterval(()=>{if(!app.isReady())return;require('node:fs').writeFileSync(${JSON.stringify(nativeStateFile)},JSON.stringify(BrowserWindow.getAllWindows().map(w=>({title:w.getTitle(),focused:w.isFocused(),visible:w.isVisible(),topmost:w.isAlwaysOnTop(),backgroundThrottling:w.webContents.getBackgroundThrottling(),bounds:w.getBounds()}))));},150).unref();` }));}}] });
await build({ entryPoints: [join(root, 'apps/desktop/src/preload.ts')], outfile: join(appDir, 'dist/preload.js'), bundle: true, platform: 'node', format: 'cjs', external: ['electron'] });
await build({ entryPoints: [join(root, 'packages/agent-chat/src/bin.ts')], outfile: join(appDir, 'dist/agent-host.mjs'), bundle: true, platform: 'node', format: 'esm', external: ['electron', 'playwright-core'],
  banner: { js: "import {createRequire as __qaRequire} from 'node:module';const require=__qaRequire(import.meta.url);" },
  plugins: [{ name: 'qa-only-fake-provider', setup(b) { b.onLoad({ filter: /agent-chat[\\/]src[\\/]bin\.ts$/ }, async ({ path }) => ({ loader: 'ts', contents: (await readFile(path, 'utf8')).replace('import { createAgentHost }', "import { FakeHarness } from './host/fake';\nimport { createAgentHost }").replace('createAgentHost({ ...message.config,', 'createAgentHost({ ...message.config, harnesses: [new FakeHarness()],') })); } }],
});
const env = { ...process.env, SYKA_DEV_RUN: '1', SYKA_DEV_URL: 'http://localhost:5188', SYKA_RUNTIME_ROOT: runtime, SYKA_MEDIA_ROOT: join(runtime, 'projects'), SYKA_MCP_PORT: String(mcpPort) };
delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_OPTIONS; delete env.SYKA_CODE_GRAPH_ROOT;
let logs = '', browser;
const child = spawn(require('electron'), ['--remote-debugging-address=127.0.0.1', '--remote-debugging-port='+cdpPort, appDir, '--hidden', '--use-fake-device-for-media-stream', '--mute-audio'], { cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
child.on('exit', (code, signal) => { logs += `QA exit ${code} ${signal}\n`; });
child.stdout.on('data', d => logs += d); child.stderr.on('data', d => logs += d);
const result = { checks: [], errors: [], provider: 'FakeHarness in QA bundle', paidCalls: false, productionProjectsChanged: false };
try {
  for (let i = 0; i < 400; i++) {
    if(child.exitCode !== null) throw Error(logs);
    try { browser = await chromium.connectOverCDP('http://127.0.0.1:'+cdpPort); break; } catch { await new Promise(r => setTimeout(r, 250)); }
  }
  assert.ok(browser, 'isolated Electron launched');
  const context = browser.contexts()[0];
  const editor = context.pages().find(p => !p.url().includes('notifications.html'));
  await editor.waitForURL(url=>url.protocol==='file:',{waitUntil:'commit',timeout:60000});
  await editor.waitForFunction(()=>!!window.desktop,{timeout:60000});
  editor.on('pageerror', error => result.errors.push(String(error)));
  editor.on('console', message => { if (['error', 'warning'].includes(message.type())) logs += 'QA EDITOR ' + message.text() + '\n'; });
  const projectDir = join(runtime, 'projects', 'QA · Notificaciones');
  await mkdir(projectDir, { recursive: true });
  await editor.evaluate(async dir => {
    const pending=new Map();window.desktop.on('main:response',r=>{const p=pending.get(r.id);if(p){pending.delete(r.id);r.ok?p.resolve(r.data):p.reject(Error(r.error));}});
    const mainBridge={call:(channel,data)=>new Promise((resolve,reject)=>{const id=crypto.randomUUID();pending.set(id,{resolve,reject});window.desktop.send('main:request',{id,channel,data});})};window.qaBridge=mainBridge;
    const p = await mainBridge.call('projects:init', { dir }); window.qaProject = p;
    let endpoint;
    for (let i = 0; i < 80 && !endpoint; i++) { endpoint = await mainBridge.call('agent-chat:endpoint', undefined); if (!endpoint) await new Promise(r => setTimeout(r, 100)); }
    if (!endpoint) throw Error('host not ready');
    const socket = new WebSocket(endpoint.url), requests = new Map(); window.qaSocket = socket;
    window.qaRpc = (method, params) => new Promise((resolve, reject) => { const id = crypto.randomUUID(); requests.set(id, { resolve, reject }); socket.send(JSON.stringify({ t: 'req', id, method, params })); });
    socket.onmessage = ({ data }) => { const m = JSON.parse(data); if (m.t === 'res') { const r = requests.get(m.id); requests.delete(m.id); if (r) m.ok ? r.resolve(m.data) : r.reject(Error(m.error.message)); } };
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    window.qaTurn = await window.qaRpc('turn.send', { projectId: p.id, cwd: dir, text: 'ask workspace', model: { harness: 'codex', model: 'fake-fast' } });
  }, projectDir);
  let overlay;
  for (let i = 0; i < 80 && !overlay; i++) { overlay = context.pages().find(p => p.url().includes('notifications.html')); if (!overlay) await new Promise(r => setTimeout(r, 100)); }
  assert.ok(overlay, 'native overlay created by host event'); overlay.on('pageerror', e => result.errors.push(String(e))); overlay.setDefaultTimeout(12000);
  const card = overlay.locator('.quick-notice').first(); await card.waitFor();
  await new Promise(r => setTimeout(r, 200));
  const nativeWindows = JSON.parse(await readFile(nativeStateFile, 'utf8'));
  assert.equal(nativeWindows.find(w => w.title.includes('Avisos'))?.focused, false, 'showInactive preserves foreground');
  result.checks.push('real host request creates native transparent window without taking focus');
  const nativeState = await editor.evaluate(() => window.qaBridge.call('syka:notifications', {action:'list'}));
  assert.equal(nativeState.desktop.alwaysOnTop, true);
  assert.equal(nativeState.desktop.visible, true);
  assert.equal(nativeState.desktop.backgroundThrottling, false);
  assert.equal(nativeState.desktop.nativeRegions, true);
  assert.ok(nativeState.desktop.regionRectangles > 0);
  result.deliveryMs = Date.now() - nativeState.notices[0].createdAt;
  result.desktop = nativeState.desktop;
  result.checks.push('native topmost window has active input regions and background throttling disabled');
  // The old idle timer stopped the orb after ten seconds. Sample after that
  // deadline, with the real native window still unfocused and no input.
  await new Promise(r => setTimeout(r, 11500));
  const idleA = await card.locator('.floating-orb canvas').evaluate(n => n.toDataURL());
  await new Promise(r => setTimeout(r, 700));
  const idleB = await card.locator('.floating-orb canvas').evaluate(n => n.toDataURL());
  assert.notEqual(idleA, idleB, 'orb continues animating beyond the old ten-second stop');
  const backgroundState = JSON.parse(await readFile(nativeStateFile, 'utf8')).find(w=>w.title.includes('Avisos'));
  assert.equal(backgroundState.focused, false);
  assert.equal(backgroundState.topmost, true);
  result.checks.push('real native orb keeps changing after twelve seconds without focus or mouse input');
  await card.locator('.quick-bubble').hover();
  await overlay.getByRole('textbox').waitFor({ state: 'visible' });
  await overlay.waitForFunction(()=>{const b=document.querySelector('.quick-bubble');return b&&Math.abs(b.offsetHeight-parseFloat(b.style.getPropertyValue('--reply-height')))<2&&innerHeight>=b.offsetHeight+12;});
  await overlay.screenshot({ path: join(output, 'native-question.png'), omitBackground: true });
  const style = await card.locator('.quick-bubble').evaluate(n => ({ border: getComputedStyle(n).borderColor, surface: getComputedStyle(n).backgroundColor, height: n.offsetHeight, width: n.offsetWidth }));
  assert.equal(style.border, 'rgba(0, 0, 0, 0)'); assert.equal(style.surface, 'rgba(8, 8, 8, 0.96)'); assert.ok(style.width <= 284);
  assert.ok(await card.getByRole('button', { name: 'Dictar mensaje' }).count());
  await card.locator('.quick-choices').getByRole('button',{name:'16:9',exact:true}).click();
  await card.locator('.quick-choices').getByRole('button',{name:'9:16',exact:true}).click();
  assert.equal(await card.locator('.quick-choices').getByRole('button',{name:'9:16',exact:true}).getAttribute('aria-pressed'),'true');
  assert.equal(await card.locator('.quick-choices').getByRole('button',{name:'16:9',exact:true}).getAttribute('aria-pressed'),'false');
  assert.equal(await card.locator('[data-action="send"]').isEnabled(),true);
  await card.locator('.quick-choices').getByRole('button',{name:'9:16',exact:true}).click();
  result.checks.push('native choices are compact selectable buttons, replace a single choice and enable send without text');
  const orb = await card.locator('.floating-orb canvas').evaluate(n => ({ width: n.width, cssWidth: n.clientWidth, bg: getComputedStyle(n.parentElement).backgroundColor }));
  assert.ok(orb.width >= 122); assert.equal(orb.cssWidth, 61); assert.equal(orb.bg, 'rgba(0, 0, 0, 0)');
  result.checks.push('approved compact black geometry, neutral border, native voice composer and HiDPI orb');
  await overlay.getByRole('textbox').press('Escape');
  await overlay.evaluate(() => document.activeElement?.blur());
  await overlay.mouse.move(1, 1);
  await overlay.waitForFunction(() => document.querySelector('.quick-bubble').dataset.expanded === 'false');
  await card.locator('.floating-orb').hover();
  await overlay.getByRole('textbox').waitFor({ state: 'visible' });
  await card.locator('.quick-bubble').hover();
  assert.equal(await card.locator('.quick-bubble').getAttribute('data-expanded'), 'true');
  result.checks.push('orb hover opens the composer and crossing to the message keeps it open');
  await overlay.mouse.move(1, 1);
  await overlay.waitForFunction(() => document.querySelector('.quick-bubble').dataset.expanded === 'false');
  // Regression: forwarded legacy mousemove must suffice without pointerenter.
  await card.locator('.quick-head').evaluate(n => {
    const r = n.getBoundingClientRect();
    n.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: r.x + 20, clientY: r.y + 20 }));
  });
  await overlay.getByRole('textbox').waitFor({ state: 'visible' });
  result.checks.push('legacy mousemove opens an unfocused notification without a pointerenter event');
  await card.locator('.quick-bubble').hover();
  await card.getByRole('button',{name:'Dictar mensaje',exact:true}).click();
  await card.getByRole('button',{name:'Transcribir',exact:true}).waitFor({state:'visible'});
  await new Promise(r=>setTimeout(r,1800));
  await card.getByRole('button',{name:'Transcribir',exact:true}).click();
  await overlay.waitForFunction(()=>document.querySelector('textarea')?.value.includes('Respuesta por voz'));
  result.checks.push('native microphone permission, recording, local audio preparation and dictation insertion with QA-only Groq response');
  const photoBytes = await readFile(join(root, 'apps/desktop/syka-assets/icon.png'));
  const chooserPromise = overlay.waitForEvent('filechooser');
  await card.getByRole('button', {name:'Adjuntar archivos',exact:true}).click();
  await (await chooserPromise).setFiles({name:'referencia.png',mimeType:'image/png',buffer:photoBytes});
  await card.locator('.agent-composer-compact-photo').waitFor();
  result.checks.push('native compact + button selects and stores a real photo in the original project');
  for (const [eventType, name] of [['paste', 'pegada.png'], ['drop', 'arrastrada.png']]) {
    await card.getByRole('textbox').evaluate((input, {eventType, name, base64}) => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([Uint8Array.from(atob(base64), ch => ch.charCodeAt(0))],name,{type:'image/png'}));
      input.dispatchEvent(eventType === 'paste' ? new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:transfer}) : new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer}));
    }, {eventType, name, base64:photoBytes.toString('base64')});
    await overlay.waitForFunction(count => document.querySelectorAll('.agent-composer-compact-photo').length === count, eventType === 'paste' ? 2 : 3);
  }
  result.checks.push('clipboard paste and drag/drop add real image files to the compact native reply');
  const encoded = await overlay.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=12;const ctx=c.getContext('2d');ctx.fillStyle='#28784d';ctx.fillRect(0,0,12,12);return {jpg:c.toDataURL('image/jpeg').split(',')[1],webp:c.toDataURL('image/webp').split(',')[1]};});
  for (const [name, mimeType, base64] of [['formato.jpg','image/jpeg',encoded.jpg],['formato.webp','image/webp',encoded.webp],['formato.gif','image/gif','R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7']]) {
    await card.locator('input[type="file"]').setInputFiles({name,mimeType,buffer:Buffer.from(base64,'base64')});
    await overlay.waitForFunction(()=>document.querySelectorAll('.agent-composer-compact-photo').length===4||!!document.querySelector('[role="alert"]'));
    assert.equal(await card.locator('.agent-composer-compact-photo').count(),4,'supported photo format '+name);
    await card.getByRole('button',{name:'Quitar archivo: '+name,exact:true}).click();
    await overlay.waitForFunction(()=>document.querySelectorAll('.agent-composer-compact-photo').length===3);
  }
  result.checks.push('native decoder and compact replies accept PNG, JPEG, WebP and GIF');
  await card.locator('input[type="file"]').setInputFiles({name:'texto.png',mimeType:'image/png',buffer:Buffer.from('not an image')});
  await card.getByRole('alert').waitFor();
  assert.equal(await card.locator('.agent-composer-compact-photo').count(),3);
  assert.match(await card.getByRole('alert').innerText(),/PNG, JPG, WebP o GIF/);
  const wrongImage = await editor.evaluate(async()=>{
    const s=await window.qaBridge.call('syka:notifications',{action:'list'}),n=s.notices.find(n=>n.kind==='question');
    try{await window.qaBridge.call('syka:notifications',{action:'answer',id:n.id,answers:{[n.request.questions[0].id]:['9:16']},attachments:['not-an-uploaded-photo']});return 'accepted';}
    catch(error){return error.message;}
  });
  assert.match(wrongImage,/otra pregunta|ya fue quitad[oa]/);
  result.checks.push('real image decoding rejects a disguised text file and unknown photo IDs without resolving the question');
  await card.getByRole('button',{name:'Quitar archivo: pegada.png',exact:true}).click();
  await overlay.waitForFunction(()=>document.querySelectorAll('.agent-composer-compact-photo').length===2);
  const imageStyle = await card.locator('.agent-composer-compact-photo').first().evaluate(n => ({w:n.offsetWidth,h:n.offsetHeight,r:getComputedStyle(n).borderRadius}));
  assert.deepEqual(imageStyle,{w:32,h:32,r:'8px'});
  await overlay.getByRole('textbox').fill(''); await overlay.evaluate(()=>document.activeElement?.blur());
  await overlay.mouse.move(1,1); await new Promise(r=>setTimeout(r,450));
  assert.equal(await card.locator('.quick-bubble').getAttribute('data-expanded'),'true');
  assert.equal(await card.locator('[data-action="send"]').isEnabled(),true);
  result.checks.push('32px rounded thumbnails can be removed and a photo-only draft stays open without mouse or focus');
  await card.locator('.quick-bubble').hover();
  await overlay.waitForFunction(()=>!document.querySelector('.notice-photo-status'));
  await card.screenshot({path:join(output,'native-question-photos.png'),omitBackground:true});
  await overlay.getByRole('textbox').fill('9:16');
  await card.locator('[data-action="send"]').click();
  await card.waitFor({ state: 'detached' });
  await editor.waitForFunction(async () => {
    const s = await window.qaRpc('chats.open', { chatId: window.qaTurn.chatId });
    return !s.pending && s.items.some(i => i.kind === 'assistant' && i.text.includes('9:16'));
  });
  result.checks.push('native composer response acknowledged by original host request and question disappears');
  const photoHistory = await editor.evaluate(async()=> (await window.qaRpc('chats.open',{chatId:window.qaTurn.chatId})).items);
  const photoReply = photoHistory.find(i=>i.kind==='user'&&i.attachments?.length);
  assert.equal(photoReply.attachments.length,2);
  for (const path of photoReply.attachments) {
    assert.ok(path.startsWith(join(projectDir,'03 Assets reutilizables','Adjuntos')));
    assert.deepEqual(await readFile(path),photoBytes);
  }
  assert.ok(photoHistory.some(i=>i.kind==='assistant'&&photoReply.attachments.every(path=>i.text.includes(path))));
  result.checks.push('original full image bytes survive the reply and exact photo paths reach the original host/provider context');
  await editor.waitForFunction(async()=> (await window.qaRpc('chats.open',{chatId:window.qaTurn.chatId})).chat.status==='idle');
  await editor.evaluate(async dir=> { window.qaTurn = await window.qaRpc('turn.send',{chatId:window.qaTurn.chatId,projectId:window.qaProject.id,cwd:dir,text:'ask workspace photo-only',model:{harness:'codex',model:'fake-fast'}}); },projectDir);
  const photoOnly = overlay.locator('.quick-notice').first(); await photoOnly.waitFor(); await photoOnly.locator('.quick-bubble').hover();
  await photoOnly.locator('input[type="file"]').setInputFiles({name:'sin-texto.png',mimeType:'image/png',buffer:photoBytes});
  await photoOnly.locator('.agent-composer-compact-photo').waitFor();
  await overlay.waitForFunction(()=>!document.querySelector('.notice-photo-status'));
  await photoOnly.locator('[data-action="send"]').click(); await photoOnly.waitFor({state:'detached'});
  await editor.waitForFunction(async()=>{const s=await window.qaRpc('chats.open',{chatId:window.qaTurn.chatId});return !s.pending&&s.items.some(i=>i.kind==='assistant'&&i.text.includes('Tomá los archivos adjuntos'));});
  result.checks.push('photo-only reply continues the waiting request without requiring typed text');
  const tools = await editor.evaluate(()=>window.qaBridge.call('syka:dependencies',undefined));
  const ffmpeg = tools.tools.find(tool=>tool.name==='ffmpeg')?.path;
  assert.ok(ffmpeg,'existing portable FFmpeg resolver finds the fixture encoder');
  const run = promisify(execFile), videoFiles = [];
  for (const [extension, codec] of [['mp4',['-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart']],['mov',['-c:v','libx264','-pix_fmt','yuv420p']],['webm',['-c:v','libvpx-vp9','-deadline','realtime','-cpu-used','8']],['mkv',['-c:v','libx264','-pix_fmt','yuv420p']]]) {
    const path=join(runtime,'referencia.'+extension);
    await run(ffmpeg,['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=0x28784d:s=96x64:r=4','-t','0.5',...codec,path],{windowsHide:true,timeout:10000});
    videoFiles.push(path);
  }
  await editor.waitForFunction(async()=> (await window.qaRpc('chats.open',{chatId:window.qaTurn.chatId})).chat.status==='idle');
  await editor.evaluate(async dir=> { window.qaTurn=await window.qaRpc('turn.send',{chatId:window.qaTurn.chatId,projectId:window.qaProject.id,cwd:dir,text:'ask workspace files',model:{harness:'codex',model:'fake-fast'}}); },projectDir);
  const filesCard=overlay.locator('.quick-notice').first();await filesCard.waitFor();await filesCard.locator('.quick-bubble').hover();
  for (const path of videoFiles) {
    await filesCard.locator('input[type="file"]').setInputFiles(path);
    await filesCard.locator('.agent-composer-compact-video').waitFor();
    assert.equal(await filesCard.locator('.agent-composer-compact-photo img').count(),1,'video poster generated for '+path);
    await overlay.waitForFunction(()=>!document.querySelector('.notice-photo-status'));
    await filesCard.locator('.agent-composer-compact-photo button').click();
    await filesCard.locator('.agent-composer-compact-photo').waitFor({state:'detached'});
  }
  result.checks.push('native upload probes real MP4/MOV/WebM/MKV and produces compact still posters with the portable media tools');
  const textBytes=Buffer.from('Referencia: vidrio verde, música elegante y títulos breves.\n<script>Texto, no interfaz.</script>');
  const videoBytes=await readFile(videoFiles[0]);
  await filesCard.locator('input[type="file"]').setInputFiles([{name:'referencia.mp4',mimeType:'video/mp4',buffer:videoBytes},{name:'brief.txt',mimeType:'text/plain',buffer:textBytes}]);
  await filesCard.locator('.agent-composer-compact-document').waitFor();
  await overlay.waitForFunction(()=>!document.querySelector('.notice-photo-status'));
  assert.equal(await filesCard.locator('.agent-composer-compact-photo').count(),2);
  const fileSizes=await filesCard.locator('.agent-composer-compact-photo').evaluateAll(nodes=>nodes.map(node=>({w:node.offsetWidth,h:node.offsetHeight,r:getComputedStyle(node).borderRadius})));
  assert.ok(fileSizes.every(size=>size.w===32&&size.h===32&&size.r==='8px'));
  assert.equal(await filesCard.locator('[data-action="send"]').isEnabled(),true);
  await filesCard.screenshot({path:join(output,'native-question-files.png'),omitBackground:true});
  result.checks.push('video and TXT share the existing 32px rounded strip; text remains an icon and file-only send is enabled');
  for (const invalid of [{name:'falso.mp4',mimeType:'video/mp4',buffer:Buffer.from('not a video')},{name:'binario.txt',mimeType:'text/plain',buffer:Buffer.from([0,1,2])}]) {
    await filesCard.locator('input[type="file"]').setInputFiles(invalid);
    await filesCard.getByRole('alert').waitFor();await overlay.waitForFunction(()=>!document.querySelector('.notice-photo-status'));
    assert.equal(await filesCard.locator('.agent-composer-compact-photo').count(),2);
  }
  result.checks.push('invalid video and binary disguised as TXT are rejected without losing the existing attachments');
  await filesCard.locator('[data-action="send"]').click();await filesCard.waitFor({state:'detached'});
  await editor.waitForFunction(async()=> {const s=await window.qaRpc('chats.open',{chatId:window.qaTurn.chatId});return !s.pending&&s.items.some(i=>i.kind==='assistant'&&i.text.includes('Tomá los archivos adjuntos'));});
  const fileHistory=await editor.evaluate(async()=> (await window.qaRpc('chats.open',{chatId:window.qaTurn.chatId})).items);
  const fileReply=fileHistory.filter(item=>item.kind==='user'&&item.attachments?.length).at(-1);
  assert.equal(fileReply.attachments.length,2);
  assert.deepEqual(await readFile(fileReply.attachments.find(path=>path.endsWith('.mp4'))),videoBytes);
  assert.deepEqual(await readFile(fileReply.attachments.find(path=>path.endsWith('.txt'))),textBytes);
  assert.ok(fileHistory.some(item=>item.kind==='assistant'&&fileReply.attachments.every(path=>item.text.includes(path))));
  result.checks.push('video/TXT originals retain exact bytes and reach the original host/provider context in an attachment-only reply');
  const artifact = join(projectDir, 'delivery.txt'); await writeFile(artifact, 'QA notification artifact');
  await editor.evaluate(async ({ dir, artifact }) => {
    for (const kind of ['complete', 'export', 'review', 'blocked', 'auth', 'transcription', 'download', 'analysis']) await window.qaBridge.call('syka:notifications', { action: 'report', projectDir: dir, projectId: window.qaProject.id, notice: { kind, operationId: 'qa-' + kind, message: 'Aviso de prueba · ' + kind, ...(['complete', 'export', 'review', 'download'].includes(kind) ? { artifact } : {}) } });
  }, { dir: projectDir, artifact });
  await overlay.waitForFunction(() => document.querySelectorAll('.quick-notice').length === 8);
  await overlay.screenshot({ path: join(output, 'native-events-stack.png'), omitBackground: true });
  result.checks.push('all eight operational kinds accumulate independently with real existing artifact');
  await editor.evaluate(async dir => { await window.qaBridge.call('syka:notifications', { action: 'report', projectDir: dir, notice: { kind: 'export', operationId: 'qa-export', artifact: dir + '/delivery.txt', message: 'Replay' } }); }, projectDir);
  assert.equal(await overlay.locator('.quick-notice').count(), 8);
  result.checks.push('operation replay does not create duplicate cards');
  await editor.evaluate(() => window.qaBridge.call('syka:notifications', { action: 'appearance', accent: '#ef80ad' }));
  await overlay.waitForFunction(() => getComputedStyle(document.querySelector('.notice-badge')).backgroundColor === 'rgb(239, 128, 173)');
  const black = await overlay.locator('.quick-bubble').first().evaluate(n => getComputedStyle(n).backgroundColor); assert.equal(black, 'rgba(8, 8, 8, 0.96)');
  result.checks.push('editor appearance colors only the dot and badge');
  // Forbidden overlay actions are filtered before any handler.
  const guarded = await overlay.evaluate(async () => {
    const MAIN_WIRE={RESPONSE:'main:response',REQUEST:'main:request'};
    const id = crypto.randomUUID(); let answered = false;
    const off = window.desktop.on(MAIN_WIRE.RESPONSE, r => { if (r.id === id) answered = true; });
    window.desktop.send(MAIN_WIRE.REQUEST, { id, channel: 'syka:notifications', data: { action: 'report', projectDir: 'wrong', notice: {} } });
    await new Promise(r => setTimeout(r, 250)); off(); return !answered;
  }); assert.equal(guarded, true); result.checks.push('notification window cannot publish operations or access arbitrary editor mutations');
  const notice = overlay.locator('[data-kind="analysis"]');
  await editor.evaluate(() => { window.qaNavigations = []; window.desktop.on('main:event', e => { if (e.channel === 'syka:notice-navigate') window.qaNavigations.push(e.data); }); });
  await notice.locator('.floating-orb').click();
  const id = await editor.evaluate(() => window.qaProject.id);
  await editor.waitForFunction(id => location.hash.includes('/projects/' + encodeURIComponent(id)), id);
  await new Promise(r => setTimeout(r, 500));
  assert.ok(editor.url().includes('/projects/' + encodeURIComponent(id)), 'existing host project is registered, not redirected back to dashboard');
  result.checks.push('native orb navigates to exact original project');
  const secondDir = join(runtime, 'projects', 'QA · Segundo proyecto');
  await mkdir(secondDir, {recursive:true});
  const second = await editor.evaluate(async dir => {
    const project = await window.qaBridge.call('projects:init', {dir});
    const turn = await window.qaRpc('turn.send', {projectId:project.id,cwd:dir,text:'ask second project',model:{harness:'codex',model:'fake-fast'}});
    return {project,turn};
  }, secondDir);
  const secondQuestion = overlay.locator('[data-kind="question"]').filter({hasText:'Segundo proyecto'});
  await secondQuestion.waitFor();
  await secondQuestion.locator('.quick-bubble').hover();
  const reply = secondQuestion.getByRole('textbox'); await reply.fill('Borrador que permanece');
  await reply.press('Escape'); await secondQuestion.locator('.quick-head').click();
  await reply.waitFor({state:'visible'}); assert.equal(await reply.inputValue(),'Borrador que permanece');
  await secondQuestion.locator('.floating-orb').click();
  await editor.waitForFunction(({project,turn}) => location.hash.includes('/projects/'+encodeURIComponent(project.id)) && JSON.parse(localStorage.getItem('dspro.ui.agentChat.active') || '{}').value?.[project.id] === turn.chatId,second);
  // The approved question layout hides the conversation while answering.
  // Its mounted transcript still has to belong to this exact second chat.
  await editor.locator('[data-chat-message="user"]').filter({hasText:'ask second project'}).waitFor({state:'attached'});
  assert.equal(await overlay.locator('.quick-notice').count(),9);
  result.checks.push('two projects accumulate independently, preserve collapsed reply draft and navigate to the exact second chat');
  const audio = await overlay.evaluate(() => new Promise(resolve => { const a = new Audio(new URL('syka-notice.wav',location.href).href); a.onloadedmetadata = () => resolve({ duration: a.duration, source: a.currentSrc }); a.onerror = () => resolve(null); }));
  assert.ok(audio?.duration > .2 && audio.duration < .3);
  result.checks.push('shipped louder sound asset decodes in native Electron');
  for (const notice of await editor.evaluate(async () => (await window.qaBridge.call('syka:notifications',{action:'list'})).notices)) await editor.evaluate(id=>window.qaBridge.call('syka:notifications',{action:'dismiss',id}),notice.id);
  assert.equal(await overlay.locator('.quick-notice').count(), 0); result.checks.push('dismissal empties and hides overlay');
  assert.deepEqual(result.errors, []);
} catch (error) {
  result.failure = String(error.stack); if (browser) {
    result.pages = browser.contexts()[0].pages().map(p => p.url());
    const e = browser.contexts()[0].pages().find(p => p.url().includes('index.html'));
    if (e) result.editorState = await e.evaluate(async () => ({ navigations: window.qaNavigations, ready: document.readyState, text: document.body.innerText.slice(0, 350), notices:await window.qaBridge?.call('syka:notifications',{action:'list'}), chat:window.qaTurn?await window.qaRpc('chats.open',{chatId:window.qaTurn.chatId}):undefined }));
    const p = browser.contexts()[0].pages().find(p => p.url().includes('notifications'));
    if (p) await p.screenshot({ path: join(output, 'failure.png'), omitBackground: true }).catch(() => {});
  }
  process.exitCode = 1;
} finally {
  await writeFile(join(output, 'qa.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result, null, 2));
  if (browser) await browser.close();
  if (child.exitCode === null) { await new Promise(resolve => { const kill = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); kill.once('exit', resolve); }); }
  await writeFile(join(output, 'native-log.txt'), logs.replace(/token=[^\s]+/g, 'token=…'));
}
