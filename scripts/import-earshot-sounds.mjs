/** Maintainer-only import of the curated, locally rendered, pinned Earshot kit. */
import { readFile, writeFile, mkdir, rename, unlink } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { soundProfile } from '../packages/agent-chat/src/host/audio-spectrum.ts';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
async function preserve(path, bytes) {
  try { if (!(await readFile(path)).equals(bytes)) throw Error('Existing Earshot asset changed: ' + path); }
  catch (error) { if (error.code !== 'ENOENT') throw error; await mkdir(dirname(path), {recursive:true}); await writeFile(path, bytes, {flag:'wx'}); }
}
export function wave24(input, frames, notice, peakLimitDb = -5.9) {
  if (input.length !== frames * 8 || !frames || frames > 48000 * 15) throw Error('Invalid Earshot render length');
  const comment = Buffer.from(notice + '\0'), info = Buffer.alloc(20 + Math.ceil(comment.length / 2) * 2);
  info.write('LIST'); info.writeUInt32LE(info.length - 8, 4); info.write('INFOICMT', 8); info.writeUInt32LE(comment.length, 16); comment.copy(info, 20);
  const pcm = Buffer.alloc(input.length), wave = Buffer.alloc(44 + frames * 6 + info.length);
  wave.write('RIFF'); wave.writeUInt32LE(wave.length - 8, 4); wave.write('WAVEfmt ', 8); wave.writeUInt32LE(16, 16);
  wave.writeUInt16LE(1, 20); wave.writeUInt16LE(2, 22); wave.writeUInt32LE(48000, 24); wave.writeUInt32LE(48000 * 6, 28);
  wave.writeUInt16LE(6, 32); wave.writeUInt16LE(24, 34); wave.write('data', 36); wave.writeUInt32LE(frames * 6, 40);
  info.copy(wave, 44 + frames * 6);
  for (let index=0; index < frames*2; index++) {
    const value = input.readFloatLE(index*4);
    if (!Number.isFinite(value) || Math.abs(value) >= 1) throw Error('Earshot PCM clips or is invalid');
    const sample = Math.round(value * 8388607);
    wave.writeIntLE(sample, 44 + index*3, 3); pcm.writeFloatLE(sample / 8388608, index*4);
  }
  const profile = soundProfile(pcm);
  if (profile.peakDb === null || profile.peakOffsetSeconds === null || profile.peakDb > peakLimitDb) throw Error('Silent or unsafe Earshot cue');
  return {wave,profile};
}
export async function importEarshotSounds(staging, docsDir=join(repo,'docs')) {
  const source = JSON.parse(await readFile(join(staging,'rendered.json'),'utf8'));
  const selectionBytes = await readFile(join(repo,'scripts/data/earshot-selection.json')), selection = JSON.parse(selectionBytes);
  if (source.commit !== selection.commit || source.sourceTreeSha256 !== '5b92635b86b2338cdaec661b6b7a2c36cf46323025fed1c3e6854f2b1c1d5f8f' || source.entries?.length !== selection.entries.length || source.selectionSha256 !== sha(selectionBytes) || source.render?.modelsLoaded !== false) throw Error('Review a different Earshot kit before importing');
  const selectedIds = new Set(selection.entries.map(entry=>entry.id));
  if (source.entries.some(entry=>!selectedIds.has(entry.id))) throw Error('Unreviewed Earshot cue in render');
  const root=join(resolve(docsDir),'resources/sounds'), catalogPath=join(root,'catalog.json'), lock=join(root,'.earshot-import.lock');
  await writeFile(lock,String(process.pid),{flag:'wx'});
  try {
    const initial=await readFile(catalogPath), catalog=JSON.parse(initial), license=await readFile(join(staging,'LICENSE-EARSHOT.txt')), credits=await readFile(join(staging,'CREDITS-EARSHOT-FIT.md'));
    if (!license.toString().includes('Copyright (c) 2026 Leon Lin') || !credits.toString().includes('CC0 1.0')) throw Error('Earshot notices missing');
    const files=[], ids=new Set(); let added=0,bytes=0;
    for (const item of source.entries) {
      if (!/^[a-z0-9_.]+\/[a-z0-9_./]+$/.test(item.id) || item.id.includes('..') || item.pcm !== item.id.replaceAll('/','--')+'.f32' || ids.has(item.id) || !/^[a-f0-9]{64}$/.test(item.recipeSha256)) throw Error('Invalid Earshot id');
      ids.add(item.id);
      if (item.measurements?.checks?.ok !== true) throw Error('Earshot technical audit needs review: '+item.id);
      if (item.id.startsWith('fit/') && item.source?.license !== 'CC0 1.0') throw Error('Unverified fitted recording source');
      const notice=license.toString()+'\nEarshot '+source.commit+'\n'+(item.source ? 'Resynthesis fitted to CC0 1.0 recording: '+item.source.url+' by '+item.source.author : 'Designed procedural recipe')+'\nNo original recording samples included.';
      const {wave,profile}=wave24(await readFile(join(staging,item.pcm)),item.frames,notice);
      const path='earshot/'+item.id+'.wav', hash=sha(wave), previous=catalog.entries.find(entry=>entry.path===path);
      const entry={path,brand:'Earshot',title:item.title,provider:'Earshot',audioType:'sfx',audioFamily:item.audioFamily,
        tags:['earshot',...item.tags,item.source?'resíntesis':'diseñado'],license:'MIT',url:source.repository,
        sha256:hash,duration:item.frames/48000,sampleRate:48000,channels:2,bitDepth:24,cuePoint:profile.peakOffsetSeconds,soundProfile:profile,
        sourceCue:item.id,sourceCommit:source.commit,recordingLicense:item.source?'CC0-1.0':undefined,
        usage:'Frozen procedural/resynthesized SFX, not original field recordings. Copy to project and align measured cuePoint. Verify by listening with the edit.'};
      if (previous && (previous.provider!=='Earshot' || previous.sha256!==hash)) throw Error('Existing catalog cue differs: '+path);
      await preserve(join(root,path),wave); bytes+=wave.length;
      if (previous) catalog.entries[catalog.entries.indexOf(previous)]=entry; else {catalog.entries.push(entry);added++;}
      files.push({path,sha256:hash,sourceCue:item.id,recipeSha256:item.recipeSha256,recordingSource:item.source,measurements:item.measurements,artisticallyAuditioned:false});
    }
    await preserve(join(root,'LICENSE-EARSHOT.txt'),license); await preserve(join(root,'CREDITS-EARSHOT-FIT.md'),credits);
    const manifest={version:2,provider:'Earshot',license:'MIT',repository:source.repository,commit:source.commit,sourceTreeSha256:source.sourceTreeSha256,selectionSha256:source.selectionSha256,
      licenseSha256:sha(license),creditsSha256:sha(credits),render:{...source.render,channels:2,bitDepth:24},
      limitations:[`Selected ${files.length} cues, not the whole bank.`,'Fitted cues are resynthesized recipes from attributed CC0 recordings.','Technical measurements do not certify artistic quality.','No Earshot/CLAP/Torch runtime or model is bundled.'],files};
    const manifestPath=join(root,'sources/earshot.json');
    let previousManifest;
    try { previousManifest=JSON.parse(await readFile(manifestPath,'utf8')); }
    catch(error) { if(error.code!=='ENOENT')throw error; }
    if (previousManifest && previousManifest.files.some(old=>!files.some(next=>next.path===old.path && next.sha256===old.sha256 && next.recipeSha256===old.recipeSha256))) throw Error('Expansion would replace or drop an existing Earshot cue');
    if (!catalog.providers.some(provider=>provider.id==='earshot')) catalog.providers.push({id:'earshot',name:'Earshot · selected kit',url:source.repository,license:'MIT',commit:source.commit,sourceManifest:'sources/earshot.json'});
    if (!(await readFile(catalogPath)).equals(initial)) throw Error('Sound catalog changed during import; retry without overwriting another update');
    await mkdir(dirname(manifestPath),{recursive:true});
    const manifestTemp=manifestPath+'.'+randomUUID()+'.tmp';
    try {await writeFile(manifestTemp,JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});await rename(manifestTemp,manifestPath);} finally {await unlink(manifestTemp).catch(()=>undefined);}
    const temp=catalogPath+'.'+randomUUID()+'.tmp';
    try {await writeFile(temp,JSON.stringify(catalog,null,2)+'\n',{flag:'wx'});await rename(temp,catalogPath);} finally {await unlink(temp).catch(()=>undefined);}
    return {added,cues:files.length,bytes,mebibytes:Math.round(bytes/1024**2*100)/100,sourceCommit:source.commit};
  } finally {await unlink(lock);}
}
if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) throw Error('Usage: node scripts/import-earshot-sounds.mjs <staging> [docs]');
  console.log(JSON.stringify(await importEarshotSounds(resolve(process.argv[2]),process.argv[3])));
}
