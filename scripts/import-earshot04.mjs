/** Append Earshot 0.4 assets without replacing any previously bundled audio. */
import { readFile, writeFile, mkdir, rename, unlink } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { wave24 } from './import-earshot-sounds.mjs';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function preserve(path,bytes) {
  try {if(!(await readFile(path)).equals(bytes))throw Error('Refusing to replace '+path);}
  catch(error){if(error.code!=='ENOENT')throw error;await mkdir(dirname(path),{recursive:true});await writeFile(path,bytes,{flag:'wx'});}
}
async function atomic(path,bytes){const tmp=path+'.'+randomUUID()+'.tmp';try{await writeFile(tmp,bytes,{flag:'wx'});await rename(tmp,path);}finally{await unlink(tmp).catch(()=>undefined);}}
export async function importEarshot04(staging,docs=join(repo,'docs')) {
  const selectedBytes=await readFile(join(repo,'scripts/data/earshot04-selection.json')), selected=JSON.parse(selectedBytes);
  const source=JSON.parse(await readFile(join(staging,'rendered.json'),'utf8'));
  if(source.commit!==selected.commit||source.sourceTreeSha256!==selected.sourceTreeSha256||source.selectionSha256!==sha(selectedBytes)||source.render.modelsLoaded!==false||source.entries.length!==selected.entries.length)throw Error('Unreviewed Earshot build');
  const root=join(docs,'resources/sounds'),catalogPath=join(root,'catalog.json'),manifestPath=join(root,'sources/earshot.json');
  const lockPath=join(root,'.earshot-import.lock');await writeFile(lockPath,String(process.pid),{flag:'wx'});
  try {
    const before=await readFile(catalogPath), previousBytes=await readFile(manifestPath),catalog=JSON.parse(before),previous=JSON.parse(previousBytes);
    const license=await readFile(join(staging,'LICENSE-EARSHOT.txt')),credits=await readFile(join(staging,'CREDITS-EARSHOT-FIT.md'));
    await preserve(join(root,'LICENSE-EARSHOT.txt'),license);await preserve(join(root,'CREDITS-EARSHOT-FIT.md'),credits);
    const files=previous.files.map(file=>({...file,sourceCommit:file.sourceCommit??previous.commit}));let added=0,bytes=0;
    const seen=new Set();
    for(const item of source.entries) {
      if(!selected.entries.some(e=>e.id===item.id)||seen.has(item.id)||!/^\w+\/[a-z0-9_]+$/.test(item.id)||item.pcm!==item.id.replaceAll('/','--')+'.f32'||item.measurements.checks.ok!==true)throw Error('Invalid selected cue');
      seen.add(item.id);
      const {wave,profile}=wave24(await readFile(join(staging,item.pcm)),item.frames,license.toString()+'\nEarshot 0.4 '+source.commit+'\nDesigned procedural recipe.');
      const path='earshot/'+item.id+'.wav',hash=sha(wave);await preserve(join(root,path),wave);bytes+=wave.length;
      const entry={path,brand:'Earshot',title:item.title,provider:'Earshot',audioType:'sfx',audioFamily:item.audioFamily,tags:['earshot',...item.tags,'diseñado'],license:'MIT',url:source.repository,sha256:hash,duration:item.frames/48000,sampleRate:48000,channels:2,bitDepth:24,cuePoint:profile.peakOffsetSeconds,soundProfile:profile,sourceCue:item.id,sourceCommit:source.commit,usage:'Earshot 0.4 selected SFX. Copy to project; align measured cuePoint; listen with the edit.'};
      const existing=catalog.entries.find(e=>e.path===path);
      if(existing&&existing.sha256!==hash)throw Error('Existing catalog sound differs');
      if(!existing){catalog.entries.push(entry);added++;files.push({path,sha256:hash,sourceCue:item.id,sourceCommit:source.commit,recipeSha256:item.recipeSha256,measurements:item.measurements,artisticallyAuditioned:false});}
    }
    const kitRoot=join(docs,'skills/syka-local-audio/resources/earshot-launch'),kit=JSON.parse(await readFile(join(staging,'launch.lock.json'),'utf8'));
    for(const role of Object.values(kit.roles).filter(Boolean)) for(const take of role.takes) {
      if(!/^[a-zA-Z0-9_.-]+\.wav$/.test(take.file)||!/^launch-[a-zA-Z0-9_.-]+\.f32$/.test(take.pcm)||take.checks.length)throw Error('Invalid launch take');
      const {wave}=wave24(await readFile(join(staging,take.pcm)),take.frames,license.toString()+'\nEarshot launch 0.4 '+source.commit+'\n'+role.sound,-.9);
      await preserve(join(kitRoot,take.file),wave);take.sha256=sha(wave);bytes+=wave.length;delete take.pcm;delete take.frames;
    }
    kit.source={repository:source.repository,commit:source.commit,sourceTreeSha256:source.sourceTreeSha256,modelsLoaded:false,artisticallyAuditioned:false};
    await preserve(join(kitRoot,'kit.lock.json'),Buffer.from(JSON.stringify(kit,null,2)+'\n'));
    await preserve(join(kitRoot,'launch.json'),await readFile(join(staging,'launch.json')));
    await preserve(join(kitRoot,'LICENSE.txt'),license);await preserve(join(kitRoot,'CREDITS_FIT.md'),credits);
    const manifest={...source,entries:undefined,files,license:'MIT',licenseSha256:sha(license),creditsSha256:sha(credits),releases:previous.releases??[{commit:previous.commit,sourceTreeSha256:previous.sourceTreeSha256}],limitations:[`Selected ${files.length} cues; full bank not bundled.`,'Original 53 audio hashes retained; each derivative keeps its own source commit.','Launch kit is frozen model-free DSP with measured per-role takes; no Python runtime required.','Technical checks do not certify artistic listening.','Optional semantic models are not bundled, downloaded or loaded automatically.']};
    if(!manifest.releases.some(r=>r.commit===source.commit))manifest.releases.push({commit:source.commit,sourceTreeSha256:source.sourceTreeSha256,selectionSha256:source.selectionSha256});
    const provider=catalog.providers.find(p=>p.id==='earshot');if(provider){provider.commit=source.commit;provider.name='Earshot · selected 0.4 kit';}
    if(!(await readFile(catalogPath)).equals(before)||!(await readFile(manifestPath)).equals(previousBytes))throw Error('Catalog changed during import');
    await atomic(manifestPath,JSON.stringify(manifest,null,2)+'\n');await atomic(catalogPath,JSON.stringify(catalog,null,2)+'\n');
    return {added,total:files.length,launchRoles:Object.values(kit.roles).filter(Boolean).length,launchTakes:Object.values(kit.roles).filter(Boolean).reduce((n,r)=>n+r.takes.length,0),bytes,modelsLoaded:false};
  } finally {await unlink(lockPath);}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await importEarshot04(resolve(process.argv[2]),process.argv[3])));
