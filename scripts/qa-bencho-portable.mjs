/** Real AssetLibrary copy/reopen check in a disposable browser, no UI/app changes. */
import {build} from 'esbuild';
import {chromium} from 'playwright-core';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
const out=resolve('../output/audits/bencho-20261025');await mkdir(out,{recursive:true});
const docs=process.argv[2]??resolve('docs'),root=join(docs,'resources/sounds');
const catalog=JSON.parse(await readFile(join(root,'catalog.json'),'utf8'));
const entries=catalog.entries.filter(e=>e.provider==='Bencho');assert.equal(entries.length,24);
const bundle=await build({entryPoints:['packages/assets/src/index.ts'],write:false,bundle:true,platform:'browser',format:'iife',globalName:'SykaAssets',conditions:['browser'],logLevel:'silent'});
const files=await Promise.all(entries.map(async e=>({name:e.path.split('/').at(-1),hash:e.sha256,base64:(await readFile(join(root,e.path))).toString('base64')})));
const browser=await chromium.launch({headless:true,executablePath:process.env.SYKA_BUILD_CHROMIUM});
try {
  const page=await browser.newPage();
  await page.route('http://127.0.0.1/bencho-qa',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Isolated audio copy QA</title>'}));
  await page.goto('http://127.0.0.1/bencho-qa');
  await page.addScriptTag({content:bundle.outputFiles[0].text});
  const report=await page.evaluate(async(files)=>{
    const stored=new Map();let manifest=null;
    const hash=async blob=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),x=>x.toString(16).padStart(2,'0')).join('');
    for(const f of files)stored.set('/bundled/bencho/'+f.name,new File([Uint8Array.from(atob(f.base64),c=>c.charCodeAt(0))],f.name,{type:'audio/wav'}));
    const fs={readManifest:async()=>manifest,writeManifest:async value=>{manifest=structuredClone(value);},list:async()=>[],stat:async path=>stored.has(path)?{size:stored.get(path).size,mtime:1}:null,file:async path=>{if(!stored.has(path))throw Error('Disconnected source '+path);return stored.get(path);},write:async(path,blob)=>{stored.set(path,new File([blob],path.split('/').at(-1),{type:blob.type}));},remove:async path=>{stored.delete(path);}};
    const library=new SykaAssets.AssetLibrary(fs);await library.load();
    const result=await library.import(files.map(f=>'/bundled/bencho/'+f.name),{copy:true,folder:'Sonidos/Bencho'});
    if(result.failed.length||result.assets.length!==24)throw Error('Audio import failed: '+JSON.stringify(result.failed.map(f=>({source:f.source,error:f.error.message}))));
    for(const asset of result.assets){if(asset.type!=='AUDIO'||asset.sampleRate!==48000||asset.channels!==2||!asset.source.startsWith('assets/'))throw Error('Invalid copied audio');}
    await library.dispose();for(const f of files)stored.delete('/bundled/bencho/'+f.name);
    const reopened=new SykaAssets.AssetLibrary(fs);await reopened.load();
    for(const f of files){const asset=await reopened.resolve('Sonidos/Bencho/'+f.name);if(await hash(await fs.file(asset.source))!==f.hash)throw Error('Copied audio bytes changed');}
    const report={copied:result.assets.length,reopenedWithoutOriginalLibrary:24,allSha256Match:true,allDecodedAsAudio:true,manifestPersisted:Boolean(manifest)};
    await reopened.dispose();return report;
  },files);
  await writeFile(join(out,'portable-project.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser.close();}
