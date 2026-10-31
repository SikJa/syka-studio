// Real native-app QA. Its build, profile, project and ports are isolated.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile, readdir, unlink, cp } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import net from 'node:net';
import * as esbuild from 'esbuild';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const require = createRequire(import.meta.url), { _electron } = require('playwright-core');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const runtime = join(root, '.runtime/subtitles-fonts-qa-2026-10-08');
const appDir = join(runtime, 'app'), project = join(runtime, 'projects', new Date().toISOString().replace(/[:.]/g,'-')), evidence = process.env.SYKA_QA_EVIDENCE ?? join(root, '../Pruebas Syka/Subtitulos-y-fuentes-2026-10-08');
const sourceProject = process.env.SYKA_QA_PROJECT;
const sceneId = sourceProject ? 'silencio' : 'subtitle_demo';
const url = 'http://127.0.0.1:5328', delay = ms => new Promise(ok => setTimeout(ok, ms));
const report = { errors: [], checks: {}, project, evidence };
let electronApp, client, vite, page, recording;
await Promise.all([5328, 3328, 9428].map(async port => {
  const server = net.createServer(); await new Promise((ok, fail) => { server.once('error', fail); server.listen(port, '127.0.0.1', ok); }); await new Promise(ok => server.close(ok));
}));
await mkdir(join(appDir, 'dist'), { recursive: true }); await mkdir(project, { recursive: true }); await mkdir(evidence, { recursive: true });
await unlink(join(runtime,'action.json')).catch(error=>{if(error.code!=='ENOENT')throw error;});
await writeFile(join(appDir, 'package.json'), JSON.stringify({ name: 'syka-subtitle-font-qa', main: 'dist/main.cjs', version: '0.207.0' }));
if (sourceProject) await cp(sourceProject, project, { recursive: true, filter: path => !/[\\/](qa-evidence|\.syka|renders)([\\/]|$)/.test(path) });
else {
await writeFile(join(project, 'package.json'), JSON.stringify({ name: 'syka-subtitles-fonts-demo', displayName: 'Biblioteca · Subtítulos y fuentes', private: true, type: 'module', main: 'index.tsx' }, null, 2));
await writeFile(join(project, 'index.tsx'), `export default function Demo(){return <stage background="#12171d"><scene id="subtitle_demo" name="Biblioteca · Subtítulos" width={1920} height={1080} end={7} active><rect id="background_demo" width={1920} height={1080} fill="#12171d" end={7}/><text id="title_demo" name="Título" x={180} y={240} width={1560} fontFamily="Inter" fontWeight={600} fontSize={112} fill="#eee8d8" end={7}>Una idea, muchas maneras.</text><text id="label_demo" x={185} y={162} width={1000} fontFamily="Inter" fontSize={24} letterSpacing={3} fill="#80c8c0" end={7}>SYKA STUDIO / BIBLIOTECA</text><captions id="captions_demo" name="Subtítulos de muestra" src="sample.json" preset="bridgeclip-subtle" align="center" start={0} end={7} selected/></scene></stage>;}\n`);
const words = [{text:'Tu',start:0,end:.7},{text:'voz',start:.7,end:1.4},{text:'merece',start:1.4,end:2.2},{text:'verse.',start:2.2,end:3.2},{text:'¿Cómo',start:3.5,end:4.2},{text:'suena',start:4.2,end:4.9},{text:'tu',start:4.9,end:5.5},{text:'idea?',start:5.5,end:6.7}];
await writeFile(join(project,'sample.json'), JSON.stringify([{ text:'Tu voz merece verse. ¿Cómo suena tu idea?', words }]));
}
await esbuild.build({ entryPoints: [join(root, 'apps/desktop/src/font-import.ts')], bundle: true, platform: 'node', format: 'esm', outfile: join(runtime,'font-import.mjs') });
const { FontStore } = await import('file:///'+join(runtime,'font-import.mjs').replace(/\\/g,'/'));
const inputDir = process.env.SYKA_QA_FONT_INPUT;
if (inputDir) {
  const files=(await readdir(inputDir)).filter(f=>/\.(otf|ttf|ttc)$/i.test(f)).map(f=>join(inputDir,f));
  const imports = await new FontStore(join(runtime,'profile-root/fonts')).import(files);
  assert.equal(imports.errors.length,0, imports.errors.join('\n'));
  report.checks.importedFamilies=[...new Set(imports.fonts.map(f=>f.family))]; report.checks.importedFaces=imports.fonts.length;
}
const docsExpression='const dir = app.isPackaged ? join(process.resourcesPath, "docs") : join(app.getAppPath(), "..", "..", "docs");';
await esbuild.build({ entryPoints:[join(root,'apps/desktop/src/main.ts')], bundle:true, platform:'node', format:'cjs', external:['electron','esbuild','@babel/core','@babel/preset-typescript','babel-preset-solid'], outfile:join(appDir,'dist/main.cjs'), plugins:[{name:'isolated-docs',setup(build){build.onLoad({filter:/[\\/]apps[\\/]desktop[\\/]src[\\/]main\.ts$/},async args=>{const source=await readFile(args.path,'utf8'); assert.equal(source.split(docsExpression).length,2); return {contents:source.replace(docsExpression,`const dir = ${JSON.stringify(join(root,'docs'))};`),loader:'ts',resolveDir:dirname(args.path)};});}}] });
await esbuild.build({entryPoints:[join(root,'apps/desktop/src/preload.ts')],bundle:true,platform:'node',format:'cjs',external:['electron'],outfile:join(appDir,'dist/preload.js')});
await esbuild.build({entryPoints:[join(root,'packages/agent-chat/src/bin.ts')],bundle:true,platform:'node',format:'esm',target:'node20',external:['electron','playwright-core'],banner:{js:"import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);"},outfile:join(appDir,'dist/agent-host.mjs')});
try {
  vite=spawn(process.execPath,[join(root,'node_modules/vite/bin/vite.js'),'--port','5328','--strictPort','--host','127.0.0.1'],{cwd:join(root,'apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe']});
  vite.stderr.on('data',b=>process.stdout.write(String(b).slice(0,300)));
  for(let i=0;i<150;i++){try{if((await fetch(url)).ok)break;}catch{} await delay(200);}
  const env={...process.env,SYKA_RUNTIME_ROOT:join(runtime,'profile-root'),SYKA_MEDIA_ROOT:runtime,SYKA_DEV_URL:url,SYKA_DEV_PORT:'5328',SYKA_MCP_PORT:'3328',SYKA_FFMPEG_PATH:'C:/ffmpeg/bin/ffmpeg.exe',SYKA_FFPROBE_PATH:'C:/ffmpeg/bin/ffprobe.exe'};
  delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_OPTIONS;
  electronApp=await _electron.launch({executablePath:require('electron'),args:[appDir,'--remote-debugging-port=9428'],cwd:root,env,timeout:60000});
  page=await electronApp.firstWindow(); await page.setViewportSize({width:1500,height:980});
  page.on('pageerror',error=>{report.errors.push(error.message); process.stdout.write('PAGE_ERROR '+error.message+'\n');});
  page.on('console',message=>{if(message.type()==='warning'&&/preset-preview|fonts/.test(message.text())){report.errors.push(message.text());process.stdout.write('WARN '+message.text()+'\n');}});
  await page.waitForLoadState('networkidle',{timeout:60000});
  client=new Client({name:'syka-subtitle-library-qa',version:'1.0'}); await client.connect(new StreamableHTTPClientTransport(new URL('http://127.0.0.1:3328/mcp')));
  async function tool(name,args){
    for(let attempt=0;attempt<3;attempt++){
      const result=await client.callTool({name,arguments:args},undefined,{timeout:name==='export'?3600000:180000});
      if(result.isError){
        if(name==='open'&&JSON.stringify(result.content).includes('app reloaded before replying')&&attempt<2){await delay(1200);continue;}
        throw Error(JSON.stringify(result.content));
      }
      return result.structuredContent ?? JSON.parse(result.content.filter(c=>c.type==='text').map(c=>c.text).join('\n'));
    }
  }
  report.open=await tool('open',{dir:project});
  await page.getByRole('tab',{name:'Biblioteca',exact:true}).waitFor({timeout:60000});
  report.checks.fonts=await tool('fonts',{limit:100});
  assert.equal(report.checks.fonts.families.filter(f=>f.origin==='included').length,13);
  assert.equal(report.checks.fonts.families.filter(f=>f.origin==='imported').length,6);
  // Font metadata alone is not rasterizer support: load every imported face in Chromium.
  report.checks.fontFaceLoads=await page.evaluate(async()=>{
    const catalog=await new Promise((ok,fail)=>{const id=crypto.randomUUID();const remove=window.desktop.on('main:response',r=>{if(r.id!==id)return;remove();r.ok?ok(r.data):fail(Error(r.error));});window.desktop.send('main:request',{id,channel:'syka:fonts',data:{action:'list'}});});
    return await Promise.all(catalog.fonts.map(async f=>{try{const face=await new FontFace(f.family,f.source,{style:f.style,weight:f.weight}).load();document.fonts.add(face);return {family:f.family,style:f.style,weight:f.weight,status:face.status};}catch(error){return {family:f.family,status:'error',error:String(error)};}}));
  });
  assert.ok(report.checks.fontFaceLoads.every(f=>f.status==='loaded'));
  await delay(2500);
  report.checks.compileLogs=await tool('logs',{tail:30,level:'error'});
  await page.screenshot({path:join(evidence,'00-project-open.png')});
  report.checks.capture=await tool('capture',{id:sceneId,times:sourceProject?['1.2','2.75','4.5','8.5','11.8']:['1.0','4.5'],output:join(evidence,'native-capture')});
  await page.getByRole('tab',{name:'Biblioteca',exact:true}).click();
  await page.getByRole('button',{name:'Subtítulos',exact:true}).click();
  await page.getByRole('button',{name:'Previsualizar Subtle · BridgeClip',exact:true}).waitFor();
  await delay(1500);
  await page.screenshot({path:join(evidence,'01-biblioteca-subtitulos.png')});
  await writeFile(join(runtime,'ready.json'), JSON.stringify({evidence,project,port:9428},null,2));
  process.stdout.write('QA_READY '+evidence+'\n');
  // The root can inspect the actual UI and supply deterministic test actions.
  for(let i=0;i<7200;i++){
    let action;
    try{action=JSON.parse(await readFile(join(runtime,'action.json'),'utf8'));}catch{}
    if(action && action.id!==report.lastAction){
      report.lastAction=action.id;
      try{
        if(action.kind==='evaluate') report.actionResult=await page.evaluate(action.code);
        else if(action.kind==='click') {await page.getByRole(action.role??'button',{name:action.name,exact:action.exact??true}).click();report.actionResult='clicked';}
        else if(action.kind==='click-label') {await page.getByLabel(action.name,{exact:true}).click();report.actionResult='clicked';}
        else if(action.kind==='mouse') {await page.mouse.click(action.x,action.y);report.actionResult='clicked';}
        else if(action.kind==='fill') {await page.getByPlaceholder(action.name,{exact:true}).fill(action.text);report.actionResult='filled';}
        else if(action.kind==='press') {await page.keyboard.press(action.key);report.actionResult='pressed';}
        else if(action.kind==='reduced-motion') {await page.emulateMedia({reducedMotion:action.value?'reduce':'no-preference'});report.actionResult='changed';}
        else if(action.kind==='wait') {await delay(Math.min(action.ms,10000));report.actionResult='waited';}
        else if(action.kind==='scroll') {await page.getByRole('button',{name:action.name,exact:true}).scrollIntoViewIfNeeded();report.actionResult='scrolled';}
        else if(action.kind==='hover') {await page.getByRole('button',{name:action.name,exact:true}).hover();report.actionResult='hovered';}
        else if(action.kind==='screenshot') {await page.screenshot({path:join(evidence,action.name)});report.actionResult='saved';}
        else if(action.kind==='tool') report.actionResult=await tool(action.name,action.args);
        else if(action.kind==='start-recording') {
          const frames=join(evidence,'frames');await mkdir(frames,{recursive:true});
          const cdp=await page.context().newCDPSession(page);const captures=[];let n=0;
          const handler=async event=>{const name=`${String(++n).padStart(5,'0')}.jpg`;captures.push({name,time:event.metadata.timestamp});await writeFile(join(frames,name),Buffer.from(event.data,'base64'));await cdp.send('Page.screencastFrameAck',{sessionId:event.sessionId});};
          cdp.on('Page.screencastFrame',handler);await cdp.send('Page.startScreencast',{format:'jpeg',quality:88,maxWidth:1500,maxHeight:980,everyNthFrame:2});
          recording={cdp,captures,handler}; report.actionResult='recording';
        } else if(action.kind==='stop-recording') {await recording.cdp.send('Page.stopScreencast');await delay(500);recording.cdp.off('Page.screencastFrame',recording.handler);await writeFile(join(evidence,'frames.json'),JSON.stringify(recording.captures,null,2));report.actionResult={frames:recording.captures.length};recording=undefined;}
        else if(action.kind==='drag') {
          const source=page.getByRole('button',{name:action.name,exact:true}), target=page.getByLabel('Mensaje al editor');
          await source.scrollIntoViewIfNeeded();
          const from=await source.boundingBox(),to=await target.boundingBox();assert.ok(from&&to);
          await page.mouse.move(from.x+from.width/2,from.y+from.height/2); await page.mouse.down();await delay(500);
          await page.mouse.move(to.x+to.width/2,to.y+to.height/2,{steps:40});await delay(700);await page.mouse.up();await delay(800);report.actionResult='dragged';
        } else if(action.kind==='end') {await writeFile(join(runtime,'result.json'),JSON.stringify({id:action.id,result:'ended'}));break;}
        else throw Error('Unknown action');
      }catch(error){report.actionResult={error:error.message};}
      await writeFile(join(runtime,'result.json'),JSON.stringify({id:action.id,result:report.actionResult},null,2));
      process.stdout.write('ACTION '+action.id+' '+String(JSON.stringify(report.actionResult)).slice(0,1500)+'\n');
    }
    await delay(250);
  }
}catch(error){report.error=error.stack;process.stdout.write('QA_ERROR '+error.stack+'\n');process.exitCode=1;}
finally{await writeFile(join(evidence,'report.json'),JSON.stringify(report,null,2));await client?.close().catch(()=>{});await electronApp?.close().catch(()=>{});if(vite?.exitCode===null)vite.kill();}
