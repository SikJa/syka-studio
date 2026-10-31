// Isolated Electron app: native GDI screen + WASAPI audio, fixture Groq response.
// No model turn, credential access, user-project mutation or installer build.
import { build } from 'esbuild';
import { _electron as electron } from 'playwright-core';
import { createRequire } from 'node:module';
import { mkdir, writeFile, readdir, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createWriteStream } from 'node:fs';
const root = resolve('.'), output = resolve('.runtime/qa/screen-recording');
await mkdir(join(output, 'project'), { recursive: true });
const require = createRequire(import.meta.url), base = '/@fs/' + root.replaceAll('\\', '/');
const htmlPath = join(output, 'fixture.html');
await writeFile(htmlPath, `<!doctype html><html class="dark"><head><meta charset="utf-8"><style>
:root{--color-background:#101010;--color-popover:#161616;--color-foreground:#eee;--color-muted-foreground:#999;--color-border:#303030;--color-accent:#282828;--color-secondary:#262626;--dropdown-open-dur:250ms;--dropdown-close-dur:150ms;--dropdown-ease:cubic-bezier(.22,1,.36,1)}
body{margin:0;background:#101010;color:#eee;font-family:Inter,sans-serif}#chat{position:absolute;bottom:24px;left:24px;width:320px}h1{font-size:16px;font-weight:500;margin:24px}.syka-agent-chat{--text:#eee;--text-soft:#aaa;--muted:#999;--line:#333;--surface:#171717;--surface-2:#222;--surface-hover:#292929;--bg:#101010;--font-body:Inter,sans-serif}button,input,textarea{font:inherit}
</style></head><body><h1>Syka · fixture aislada del chat</h1><div id="chat" class="syka-agent-chat"></div><script>window.qaErrors=[];addEventListener('error',event=>window.qaErrors.push(event.message));addEventListener('unhandledrejection',event=>window.qaErrors.push(String(event.reason)));
</script><script type="module">
import {render} from '/node_modules/.vite/deps/solid-js_web.js';
import {createSignal,createComponent} from '/node_modules/.vite/deps/solid-js.js';
import {Router} from '${base}/node_modules/@solidjs/router/dist/index.jsx';
import {Composer} from '${base}/apps/web/src/agent-chat/mirel-composer.tsx';
const [text,setText]=createSignal('Revisá esta animación.');const [attachments,setAttachments]=createSignal([]);
window.qaState=()=>({text:text(),attachments:attachments()});window.qaSetText=setText;
render(()=>createComponent(Router,{root(){return createComponent(Composer,{projectDir:${JSON.stringify(join(output, 'project'))},chatKey:'isolated-recording-qa',get text(){return text()},get attachments(){return attachments()},onText:setText,onAttachments:setAttachments,running:false,waiting:false,blocked:null,model:{harness:'codex',model:'gpt-6.1-sol'},onModel(){},onSend(){throw Error('No model turn authorized in QA')},onStop(){}})},children:[]}),document.getElementById('chat'));
</script></body></html>`);
const mainPath = join(output, 'main.cjs');
const entry = `
import {app,BrowserWindow,ipcMain,session} from 'electron';
import {mkdir,open,readFile,rename,unlink} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {registerScreenCapture} from ${JSON.stringify(join(root, 'apps/desktop/src/screen-capture.ts'))};
import {permissionAllowed} from ${JSON.stringify(join(root, 'apps/desktop/src/syka-permissions.ts'))};
import {mainBridge} from ${JSON.stringify(join(root, 'apps/desktop/src/main-manager.ts'))};
import {MAIN_CHANNELS} from ${JSON.stringify(join(root, 'apps/desktop/src/main-channels.ts'))};
app.setPath('userData',${JSON.stringify(join(output, 'profile'))});
app.getAppPath=()=>${JSON.stringify(join(root,'apps/desktop'))};
registerScreenCapture(mainBridge);
// Filter the source picker only; capture validation still enumerates real windows.
const originalHandle=mainBridge.handle.bind(mainBridge);
let fixture,control;const writes=new Map();
mainBridge.setRequestGuard(event=>event.sender===control?.webContents);
const envPermissions={microphone:true,clipboard:false,fonts:false,notifications:false};
mainBridge.handle(MAIN_CHANNELS.SYKA_GROQ_STATUS,()=>({configured:true}));
mainBridge.handle(MAIN_CHANNELS.SYKA_GROQ_TRANSCRIBE,data=>{
 if(new TextDecoder().decode(data.audio.slice(0,4))!=='OggS')throw Error('Speech was not prepared as bounded Ogg audio');
 return [{text:'Mové el título un poco hacia arriba.',words:[{text:'Mové',start:0,end:.2},{text:'el título un poco hacia arriba.',start:.2,end:1.2}]}];});
mainBridge.handle(MAIN_CHANNELS.SYKA_GLOSSARY_APPLY_TRANSCRIPT,data=>data.segments);
mainBridge.handle(MAIN_CHANNELS.FILE_WRITE_OPEN,async data=>{const path=resolve(data.path),allowed=${JSON.stringify(join(output, 'project'))};if(!path.startsWith(allowed+require('node:path').sep))throw Error('QA writes must stay in the isolated project');await mkdir(dirname(path),{recursive:true});const temp=path+'.partial',file=await open(temp,'wx'),id=crypto.randomUUID();writes.set(id,{file,path,temp});return {id};});
mainBridge.handle(MAIN_CHANNELS.FILE_WRITE_CHUNK,async data=>{const {file}=writes.get(data.id);await file.write(data.data,0,data.data.length,data.position);});
mainBridge.handle(MAIN_CHANNELS.FILE_WRITE_CLOSE,async data=>{const item=writes.get(data.id);await item.file.close();await rename(item.temp,item.path);writes.delete(data.id);});
mainBridge.handle(MAIN_CHANNELS.FILE_WRITE_ABORT,async data=>{const item=writes.get(data.id);if(item){await item.file.close();await unlink(item.temp);writes.delete(data.id);}});
app.whenReady().then(async()=>{
fixture=new BrowserWindow({x:20,y:40,width:500,height:320,show:false,title:'Syka capture QA target',webPreferences:{contextIsolation:true,backgroundThrottling:false}});
await fixture.loadURL('data:text/html,<title>Syka capture QA target</title><body style="background:%2312151b;color:white;font:24px sans-serif;padding:20px">Syka · captura de prueba<canvas id="canvas" width="300" height="100"></canvas><script>let x=0;setInterval(()=>{let c=document.getElementById("canvas").getContext("2d");c.fillStyle="%2312151b";c.fillRect(0,0,300,100);c.fillStyle="%2385b6aa";c.fillRect((x+=3)%260,20,40,40)},33)</script>');fixture.showInactive();
control=new BrowserWindow({width:820,height:750,show:false,webPreferences:{preload:${JSON.stringify(join(root, 'apps/desktop/dist/preload.js'))},contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
control.webContents.on('console-message',(_event,...args)=>console.log('QA console:',...args));
await control.loadURL(${JSON.stringify('http://localhost:5188/@fs/' + htmlPath.replaceAll('\\', '/'))});
});app.on('window-all-closed',()=>app.quit());`;
await build({ stdin: { contents: entry, resolveDir: root, sourcefile: 'screen-recording-qa-main.ts', loader: 'ts' }, outfile: mainPath, bundle: true, platform: 'node', format: 'cjs', external: ['electron'] });
const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_OPTIONS;
const application = await electron.launch({ executablePath: require('electron'), args: [mainPath], env, timeout: 30000 });
const processLog=createWriteStream(join(output,'electron.log'));application.process().stdout?.pipe(processLog,{end:false});application.process().stderr?.pipe(processLog,{end:false});
application.on('window',page=>page.on('pageerror',error=>console.error('QA page error:',String(error))));
try {
  let page;
  const deadline=Date.now()+20000;
  while(Date.now()<deadline){page=application.windows().find(p=>p.url().includes('fixture.html'));if(page)break;await new Promise(r=>setTimeout(r,100));}
  if(!page)throw Error('Isolated composer did not load');
  const errors=[];page.on('pageerror',error=>errors.push(String(error)));page.setDefaultTimeout(15000);
  await page.getByRole('button',{name:'Agregar archivos y herramientas'}).click();
  const menu=page.getByRole('dialog',{name:'Agregar al chat'});await menu.waitFor();
  await menu.screenshot({animations:'disabled',path:join(output,'menu.png')});
  await page.keyboard.press('End');if(await page.evaluate(()=>document.activeElement?.textContent)!=='Plugins y complementos')throw Error('End did not reach the final action');
  await page.keyboard.press('Escape');await menu.waitFor({state:'detached'});
  if(await page.getByRole('button',{name:'Agregar archivos y herramientas'}).evaluate(el=>el!==document.activeElement))throw Error('Escape did not restore focus');
  await page.getByRole('button',{name:'Agregar archivos y herramientas'}).click();await menu.getByRole('button',{name:'Grabar pantalla',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Grabar pantalla'});await dialog.getByRole('button',{name:'Pantalla 1',exact:true}).waitFor();
  await dialog.getByRole('combobox',{name:'Audio de la grabación'}).selectOption('both');
  await dialog.screenshot({animations:'disabled',path:join(output,'recording-setup.png')});
  await dialog.getByRole('button',{name:'Empezar a grabar'}).click();
  await dialog.getByRole('button',{name:'Pausar grabación'}).waitFor();await new Promise(r=>setTimeout(r,1800));
  await dialog.getByRole('button',{name:'Pausar grabación'}).click();await dialog.getByRole('button',{name:'Continuar grabación'}).click();
  await new Promise(r=>setTimeout(r,1800));await dialog.getByRole('button',{name:'Terminar',exact:true}).click();
  await dialog.getByText('Mové el título un poco hacia arriba.',{exact:true}).waitFor();
  const state=await page.evaluate(()=>window.qaState());
  if(!state.text.includes('Revisá esta animación.')||!state.text.includes('Mové el título'))throw Error('Original draft or transcript lost');
  if(state.attachments.filter(a=>a.name.endsWith('.mp4')).length!==1||state.attachments.filter(a=>a.name.endsWith('.transcript.txt')).length!==1)throw Error('Video and transcript were not attached exactly once');
  console.log('QA reached transcript and video attachment');
  await dialog.locator('video').evaluate(video=>new Promise((done,fail)=>{setTimeout(()=>fail(Error('Video metadata timeout: '+JSON.stringify({src:video.src,readyState:video.readyState,networkState:video.networkState,error:video.error?.message}))),10000);if(video.readyState>=1)return done();video.addEventListener('loadedmetadata',done,{once:true});video.addEventListener('error',()=>fail(Error('Native MP4 preview failed '+video.error?.message)),{once:true});}));
  const metadata=await dialog.locator('video').evaluate(video=>({width:video.videoWidth,height:video.videoHeight,duration:video.duration}));
  if(!metadata.width||metadata.duration<2)throw Error('Native preview has no video');
  await dialog.screenshot({animations:'disabled',path:join(output,'recording-result.png')});await dialog.getByRole('button',{name:'Listo',exact:true}).click();
  await page.setViewportSize({width:340,height:560});await page.getByRole('button',{name:'Agregar archivos y herramientas'}).click();
  await menu.waitFor();const bounds=await menu.boundingBox();if(!bounds||bounds.x<0||bounds.y<0||bounds.x+bounds.width>341||bounds.y+bounds.height>561)throw Error('Menu overflows the small viewport');
  await menu.screenshot({animations:'disabled',path:join(output,'menu-small.png')});await page.keyboard.press('Escape');
  if(errors.length)throw Error(errors.join('\n'));
  const files=await readdir(join(output,'project/03 Assets reutilizables/Adjuntos'));
  if(files.some(name=>name.endsWith('.partial')))throw Error('An unfinished write was left behind');
  const report={actualNativeRecording:true,metadata,audio:'Windows system loopback and actual default microphone',pauseResume:true,videoAttached:true,transcriptInserted:true,groq:'fixture only; no provider request',keyboard:true,viewport:true,files:state.attachments.map(a=>({name:a.name,path:a.path,size:a.size}))};
  await writeFile(join(output,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
} catch(error) {
  console.error('QA original error:',String(error));
  const page=application.windows().find(p=>p.url().includes('fixture.html'));
  if(page){console.error('QA body:',(await page.locator('body').innerText()).slice(0,2200));console.error('QA startup errors:',await page.evaluate(()=>window.qaErrors));await page.screenshot({animations:'disabled',path:join(output,'failure.png')}).catch(()=>{});}
  throw error;
} finally { await application.close().catch(()=>{});processLog.end(); }
