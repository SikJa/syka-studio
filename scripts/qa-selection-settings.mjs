// Hidden Electron fixture: actual project list, Help, storage UI and native IPC.
// Uses its own profile and tiny project folders. No user project or model calls.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { _electron as electron } from 'playwright-core';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
const root=resolve('.'),output=resolve('.runtime/qa/selection-settings'),base='/@fs/'+root.replaceAll('\\','/');
await mkdir(join(output,'profile'),{recursive:true});
const projects=[];
for(let index=1;index<=24;index++){
  const name=`Proyecto ${String(index).padStart(2,'0')}`,dir=join(output,'projects',String(index));
  await mkdir(dir,{recursive:true});await writeFile(join(dir,'main.tsx'),'x'.repeat(index));
  projects.push({id:`qa-${index}`,dir,name,displayName:name,entry:'main.tsx',modifiedAt:`2026-10-09T12:${String(index).padStart(2,'0')}:00.000Z`,createdAt:'2026-10-09T00:00:00.000Z'});
}
const html=join(output,'fixture.html');
await writeFile(html,`<!doctype html><html data-kb-theme="dark"><head><meta charset="utf-8"><style>body{margin:0;font:13px Inter,sans-serif;background:#111;color:#eee}#root{height:100vh;display:flex;flex-direction:column;max-width:1080px;margin:auto}</style></head><body><div id="root"></div><script type="module">
import {render} from '/node_modules/.vite/deps/solid-js_web.js';
import {createSignal,createComponent,createMemo} from '/node_modules/.vite/deps/solid-js.js';
import {Router} from '${base}/node_modules/@solidjs/router/dist/index.jsx';
import '${base}/apps/web/src/index.css';
import '${base}/apps/web/src/components/settings/settings.css';
import {DashboardProjectsView} from '${base}/apps/web/src/components/dashboard/projects-view.tsx';
import {DashboardHelpView} from '${base}/apps/web/src/components/dashboard/help-view.tsx';
import {StorageSettings} from '${base}/apps/web/src/components/settings/storage.tsx';
import {addProjectRecords} from '${base}/apps/web/src/lib/db.ts';
import {mainBridge} from '${base}/apps/web/src/lib/ipc.ts';
import {MAIN_CHANNELS} from '${base}/apps/desktop/src/main-channels.ts';
await addProjectRecords(${JSON.stringify(projects)});
const [view,setView]=createSignal('projects');window.qaSetView=setView;
window.qaMeasure=()=>mainBridge.call(MAIN_CHANNELS.SYKA_STUDIO_SETTINGS,{action:'storage',projects:${JSON.stringify(projects.map(project=>({name:project.displayName,path:project.dir})))}});
render(()=>createComponent(Router,{root:()=>createMemo(()=>view()==='projects'?createComponent(DashboardProjectsView,{}):view()==='help'?createComponent(DashboardHelpView,{}):createComponent(StorageSettings,{}))}),document.getElementById('root'));
</script></body></html>`);
const entry=`import {app,BrowserWindow,session} from 'electron';import {mainBridge} from ${JSON.stringify(join(root,'apps/desktop/src/main-manager.ts'))};import {registerStudioSettings} from ${JSON.stringify(join(root,'apps/desktop/src/studio-settings.ts'))};
app.disableHardwareAcceleration();app.setPath('userData',${JSON.stringify(join(output,'profile'))});process.env.SYKA_RUNTIME_ROOT=${JSON.stringify(join(output,'runtime'))};let control;
app.whenReady().then(async()=>{session.defaultSession.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!details.url.startsWith('http://localhost:5188/')&&!details.url.startsWith('ws://localhost:5188/')&&!details.url.startsWith('data:')}));mainBridge.setRequestGuard(event=>event.sender===control?.webContents);registerStudioSettings(mainBridge);control=new BrowserWindow({width:1100,height:780,show:false,webPreferences:{preload:${JSON.stringify(join(root,'apps/desktop/dist/preload.js'))},contextIsolation:true,nodeIntegration:false,backgroundThrottling:false,offscreen:true}});await control.loadURL(${JSON.stringify('http://localhost:5188/@fs/'+html.replaceAll('\\','/'))});});app.on('window-all-closed',()=>app.quit());`;
const main=join(output,'main.cjs');
await build({stdin:{contents:entry,resolveDir:root,sourcefile:'selection-settings-qa.ts',loader:'ts'},outfile:main,bundle:true,platform:'node',format:'cjs',external:['electron']});
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
const require=createRequire(import.meta.url),application=await electron.launch({executablePath:require('electron'),args:[main],env,timeout:30000});
try{
  const page=await application.firstWindow();page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',error=>errors.push(String(error)));
  await page.getByRole('heading',{name:'Proyectos (24)',exact:true}).waitFor();
  const nav=page.getByRole('navigation',{name:'Páginas de proyectos'});
  assert.ok((await nav.innerText()).includes('Página 1 de 3'));
  await nav.getByRole('button',{name:'Siguiente'}).click();assert.ok((await nav.innerText()).includes('Página 2 de 3'));
  await nav.getByRole('button',{name:'Siguiente'}).click();assert.ok((await nav.innerText()).includes('Página 3 de 3'));assert.equal(await nav.getByRole('button',{name:'Siguiente'}).isDisabled(),true);
  await page.getByRole('textbox',{name:'Buscar en todos los proyectos'}).fill('Proyecto 24');
  await page.getByRole('heading',{name:'Proyectos (1)',exact:true}).waitFor();assert.equal(await nav.count(),0);await page.getByText('Proyecto 24',{exact:true}).waitFor();
  await page.screenshot({path:join(output,'all-projects-search.png')});
  await page.evaluate(()=>window.qaSetView('help'));
  const discord=page.getByRole('link',{name:'Abrir Discord de Syka'});await discord.waitFor();assert.equal(await discord.getAttribute('href'),'https://discord.gg/Sy5dtySQG9');
  await page.evaluate(()=>window.qaSetView('storage'));
  await page.getByText('24 proyectos · total en sus carpetas',{exact:true}).waitFor();await page.getByText('300 B',{exact:true}).waitFor();
  const storage=await page.evaluate(()=>window.qaMeasure());assert.equal(storage.storage.projects.length,24);assert.equal(storage.storage.projects.reduce((total,item)=>total+item.bytes,0),300);assert.ok(storage.storage.projects.every(item=>item.availableBytes>0));
  await page.screenshot({path:join(output,'storage.png')});assert.deepEqual(errors,[]);
  const result={passed:true,actualNativeIPC:true,projectCount:24,totalProjectBytes:300,checks:['all pages reachable','last page bounds','search sees projects outside current page','search resets page','Discord link','per-project sizes','total project bytes','disk availability per project'],errors};
  await writeFile(join(output,'verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await application.close();}
