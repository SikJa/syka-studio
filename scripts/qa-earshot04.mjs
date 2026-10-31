/** Isolated native-project integration QA. Never opens or edits a user project. */
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';
const repo=resolve('.'),out=resolve('../output/audits/earshot04-20261022');await mkdir(out,{recursive:true});
const helper=resolve('.runtime/earshot-0.4-20261022/native-qa-api.cjs');
await build({stdin:{contents:`export { WorkspaceTools } from './packages/agent-chat/src/host/workspace-tools';
export { SourceTools } from './packages/agent-chat/src/host/source-tools';
export { compileProject } from './apps/desktop/src/projects';
export { audioReview } from './packages/agent-chat/src/host/sound-design';`,resolveDir:repo,loader:'ts'},outfile:helper,bundle:true,platform:'node',format:'cjs',external:['esbuild','@babel/core','@babel/preset-typescript','babel-preset-solid','playwright-core'],logLevel:'silent',
plugins:[{name:'isolated-electron-stub',setup(b){b.onResolve({filter:/^electron$/},()=>({path:'electron',namespace:'qa'}));b.onLoad({filter:/.*/,namespace:'qa'},()=>({contents:'export const app={isPackaged:false,getPath:()=>"."};export const dialog={};export const shell={};export const ipcMain={on(){}};',loader:'js'}));}}]});
const {WorkspaceTools,SourceTools,compileProject,audioReview}=createRequire(import.meta.url)(helper);
const project=resolve('.runtime/earshot-0.4-20261022/native-project-'+Date.now());await mkdir(project,{recursive:true});
await copyFile(join(repo,'docs/resources/sounds/opendesign/product-promo.mp3'),join(project,'bed.mp3'));
execFileSync(process.env.SYKA_FFMPEG_PATH,['-nostdin','-v','error','-i',join(project,'bed.mp3'),'-af','loudnorm=I=-18:TP=-3:LRA=11','-ar','48000','-ac','2','-c:a','pcm_s24le',join(project,'bed.wav')],{windowsHide:true});
await copyFile(join(repo,'docs/resources/sounds/LICENSE-OPENDESIGN.txt'),join(project,'LICENSE-MUSIC.txt'));
await writeFile(join(project,'package.json'),JSON.stringify({name:'earshot04-native-qa',displayName:'Earshot 0.4 · prueba nativa',main:'index.tsx',projectId:'earshot04-native-qa'}));
const original='export default () => <stage frameRate={30}><scene id="earshot-qa" name="Earshot launch QA" width={640} height={360} end={10} active><rect width={640} height={360} fill="#101112" /></scene></stage>;\n';
await writeFile(join(project,'index.tsx'),original);
const tools=new WorkspaceTools(project,join(repo,'docs'),undefined,undefined,undefined,process.env);
let result;
try {
  result=await tools.call('syka_launch_audio',{action:'create',duration:10,seed:3107,bed:'bed.wav',bedVolumeDb:-3,bedSourceIn:1,includeBed:true,stopDown:true,cues:[
    {id:'appear',role:'pop',seconds:.6},{id:'press',role:'click',seconds:1.3},{id:'move',role:'whoosh.short',seconds:2.5},
    {id:'type1',role:'key',seconds:3.1},{id:'type2',role:'key',seconds:3.19},{id:'cut',role:'hit',seconds:4.5},
    {id:'detail',role:'snap',seconds:6},{id:'arrive',role:'land',seconds:7.5},{id:'done',role:'click.confirm',seconds:9.2},
  ]});
  const source=new SourceTools(project),read=await source.call('syka_read_source',{path:'index.tsx'});
  await source.call('syka_edit_source',{path:'index.tsx',expectedSha256:read.sha256,content:result.componentImport+'\n'+original.replace('</scene>',result.componentJSX+'</scene>')});
}finally{await tools.close();}
const compiled=await compileProject(project);assert.equal(compiled.ok,true,compiled.error);await writeFile(join(out,'native-project.cjs'),compiled.code);
const plan=JSON.parse(await readFile(join(project,result.plan),'utf8'));
const browser=await chromium.launch({headless:true,executablePath:'C:/Users/CHAMP/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe'});
const page=await browser.newPage(),errors=[],messages=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',message=>messages.push(message.type()+': '+message.text()));
try {
  await page.route('**/qa-earshot04',route=>route.fulfill({contentType:'text/html',headers:{'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'credentialless'},body:'<!doctype html><meta charset="utf-8"><title>Native Earshot QA</title><canvas width="640" height="360"></canvas>'}));
  await page.goto('http://127.0.0.1:5241/qa-earshot04',{waitUntil:'networkidle',timeout:90000});
  const rendered=await page.evaluate(async({repo,project,code})=>{
    const fs='/@fs/'+repo.replaceAll('\\','/'),base='/@fs/'+project.replaceAll('\\','/');
    const runtime=await import(fs+'/packages/runtime/src/index.ts'),reconciler=await import(fs+'/packages/reconciler/src/index.ts');
    const {AssetLibrary}=await import(fs+'/packages/assets/src/index.ts');
    const {createEncoder}=await import(fs+'/packages/encoder/src/encoder.ts');
    const files=new Map();
    async function file(path){if(!files.has(path)){const response=await fetch(base+'/'+path);if(!response.ok)throw Error('Missing file '+path);const blob=await response.blob();files.set(path,new File([blob],path.split('/').at(-1),{type:blob.type}));}return files.get(path);}
    const library=new AssetLibrary({readManifest:async()=>null,writeManifest:async()=>{},list:async()=>[],stat:async path=>{try{return {size:(await file(path)).size,mtime:0};}catch{return null;}},file,write:async()=>{},remove:async()=>{}});
    await library.load();const world=runtime.createRuntimeWorld('earshot-native-audio-qa');world.set(runtime.Library,library);
    world.set(runtime.FramePromises,{list:[]});
    const canvas=document.querySelector('canvas');world.set(runtime.RenderSurface,{canvas,ctx:canvas.getContext('2d')});
    world.set(runtime.Mode,{value:'offline-audio'});
    const mounted=reconciler.mount(code,world);
    const scenes=world.query(runtime.Scene),scene=scenes[0];if(!scene)throw Error('No native scene');
    const audio=world.query(runtime.Audio).map(e=>({id:e.id(),source:e.get(runtime.Source),authored:reconciler.authoredElement(e)}));
    if(audio.length!==10)throw Error('Expected 10 native audio nodes; got '+audio.length);
    const music=audio.find(a=>a.authored.props.name==='Música · launch');if(!music)throw Error('Missing native bed');
    const children=world.query(runtime.KeyframeTrack).length;if(children<1)throw Error('Missing native volume envelope');
    for(const time of [0,1.3,4.1,4.5,7.5,9.5,4.5]){runtime.setPlayhead(world,scene,time);runtime.motionSystem(world);}
    const encoder=await createEncoder(world,{format:'ogg',video:{enabled:false},audio:{enabled:true,codec:'opus',sampleRate:48000,numberOfChannels:2,bitrate:192000}});
    const sourceErrors=world.query(runtime.SourceError).map(e=>({source:e.get(runtime.Source),error:e.get(runtime.SourceError)}));
    if(sourceErrors.length)throw Error('Native asset resolution failed: '+JSON.stringify(sourceErrors));
    const output=await encoder.render();if(output.type!=='success'||!output.data)throw Error('Native export failed: '+output.error?.message);
    const bytes=new Uint8Array(await output.data.arrayBuffer());let text='';for(let i=0;i<bytes.length;i+=16384)text+=String.fromCharCode(...bytes.subarray(i,i+16384));
    const computed=runtime.store(world,runtime.Computed);
    const debug=world.query(runtime.Audio).map(e=>({name:reconciler.authoredElement(e)?.props.name,geometry:e.has(runtime.Geometry),asset:e.get(runtime.AssetId),ready:e.get(runtime.AudioDecoderHandle)?.ready,parent:runtime.getParentNode(e)?.id(),start:computed.start[e.id()],end:computed.end[e.id()],origin:computed.origin[e.id()],volume:computed.volume[e.id()],visibility:computed.visibility[e.id()]}));
    const state={silent:world.has(runtime.Silent),mode:world.get(runtime.Mode),root:world.get(runtime.Root)?.id(),scene:scene.id(),sceneGeometry:scene.has(runtime.Geometry),sceneGroup:scene.has(runtime.Group),sceneHidden:scene.has(runtime.Hidden),playing:scene.get(runtime.Playback),buses:world.query(runtime.AudioBusHandle).length,decoders:world.query(runtime.AudioDecoderHandle).length,sceneParent:runtime.getParentNode(scene)?.id()};
    const report={nativeAudioNodes:audio.length,volumeTracks:children,authored:audio.map(a=>a.authored),state,debug,files:[...files.keys()],sourceStamps:audio.every(a=>Boolean(a.source?.value)),exportBytes:bytes.length,exportBase64:btoa(text)};
    mounted.dispose();world.destroy();return report;
  },{repo,project,code:compiled.code});
  await writeFile(join(out,'browser-debug.json'),JSON.stringify({messages,errors,bytes:rendered.exportBytes,state:rendered.state,debug:rendered.debug,files:rendered.files,authored:rendered.authored},null,2));
  assert.ok(rendered.sourceStamps);assert.ok(rendered.exportBytes>5000);assert.deepEqual(errors,[]);
  const {exportBase64,...native}=rendered;await writeFile(join(project,'native-launch-audio.ogg'),Buffer.from(exportBase64,'base64'));
  const report=await audioReview(project,{source:'native-launch-audio.ogg',cues:plan.cues.filter(c=>['pop','click','hit','click.confirm'].includes(c.role)).map(c=>({id:c.id,seconds:c.start+c.syncPointSeconds-c.sourceIn,asset:join(result.assetsDirectory,c.file),assetCuePointSeconds:c.syncPointSeconds,toleranceMs:50}))},{env:process.env});
  const evidence={native,audioReview:report,errors,fixtureOnly:true,liveUserWindowVerified:false,modelsLoaded:false};
  await writeFile(join(out,'native-report.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify({nativeAudioNodes:native.nativeAudioNodes,volumeTracks:native.volumeTracks,sourceStamps:native.sourceStamps,exportBytes:native.exportBytes,lufs:report.integratedLufs,truePeak:report.truePeakDb,cues:report.cues.map(c=>({id:c.id,status:c.status,offsetMs:c.offsetMs})),project}));
}finally{await browser.close();}
