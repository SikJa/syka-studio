import { describe,it,expect } from 'vitest';
import { mkdtemp,mkdir,copyFile,readFile,writeFile,rm } from 'node:fs/promises';
import { join,dirname,resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { resourceLibrary,type ResourceResult } from '../src/host/resource-library';
import { WorkspaceTools } from '../src/host/workspace-tools';
import { checkSoundCatalog } from '../../../scripts/check-sound-catalog.mjs';
const docs=resolve(import.meta.dirname,'../../../docs'),sounds=join(docs,'resources/sounds');
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
describe('Bencho public sounds persisted integration',()=>{
  it('finds all 24 public sounds through the real agent search, with compact pagination and timing',async()=>{
    const project=await mkdtemp(join(tmpdir(),'syka-bencho-agent-'));
    const tools=new WorkspaceTools(project,docs,undefined,join(project,'resources.json'));
    try {
      const entries=[];let offset=0;
      do {
        const result=await tools.call('syka_resources',{action:'list',kind:'sounds',audioType:'sfx',query:'Bencho',limit:4,maxChars:12000,offset}) as ResourceResult;
        expect(result.total).toBe(24);expect(result.warnings).toEqual([]);entries.push(...result.entries);offset=result.nextOffset??-1;
      }while(offset>=0);
      expect(entries).toHaveLength(24);expect(new Set(entries.map(e=>e.id)).size).toBe(24);
      for(const e of entries){expect(e.provider).toBe('Bencho');expect(e.license).toBe('MIT');expect(e.path.startsWith(sounds)).toBe(true);expect(e.soundProfile).toBeDefined();expect(e.cuePoint).toBeGreaterThanOrEqual(0);expect(e.cuePoint).toBeLessThan(e.duration!);}
    }finally{await tools.close();await rm(project,{recursive:true,force:true});}
  },30000);
  it('previews all saved 24-bit WAVs byte-for-byte and retains notices in a relocated library',async()=>{
    const fixture=await mkdtemp(join(tmpdir(),'syka-bencho-disk-')),root=join(fixture,'resources/sounds');
    try {
      const catalog=JSON.parse(await readFile(join(sounds,'catalog.json'),'utf8'));
      const entries=catalog.entries.filter((e:any)=>e.provider==='Bencho');expect(entries).toHaveLength(24);
      for(const file of [...entries.map((e:any)=>e.path),'LICENSE-SYKA.txt','LICENSE-BENCHO.txt','CREDITS-BENCHO.md','sources/bencho.json']){await mkdir(dirname(join(root,file)),{recursive:true});await copyFile(join(sounds,file),join(root,file));}
      await writeFile(join(root,'catalog.json'),JSON.stringify({version:1,entries}));
      expect(await checkSoundCatalog(fixture)).toMatchObject({count:24,providers:{Bencho:24}});
      for(const entry of entries){
        expect(entry.soundProfile.peakDb).toBeLessThan(0);
        const preview=await resourceLibrary(join(fixture,'config.json'),{action:'preview',path:join(root,entry.path)},undefined,root);
        expect(preview.preview).toMatch(/^data:audio\/wav;base64,/);
        const wav=Buffer.from(preview.preview!.split(',')[1]!,'base64');expect(sha(wav)).toBe(entry.sha256);
        expect(wav.readUInt16LE(34)).toBe(24);expect(wav.readUInt32LE(24)).toBe(48000);expect(wav.readUInt16LE(22)).toBe(2);
        expect(wav.includes(Buffer.from('Copyright (c) 2026 Lorenzo Cabra'))).toBe(true);expect(wav.includes(Buffer.from('Copyright (c) 2026 Daniel Belyi'))).toBe(true);
      }
      const proof=join(root,'sources/bencho.json'),manifest=JSON.parse(await readFile(proof,'utf8'));manifest.freeOnly=false;
      await writeFile(proof,JSON.stringify(manifest));await expect(checkSoundCatalog(fixture)).rejects.toThrow('Bencho license/provenance');
      await copyFile(join(sounds,'sources/bencho.json'),proof);
      const broken=Buffer.from(await readFile(join(root,entries[0].path)));broken[50]^=1;await writeFile(join(root,entries[0].path),broken);
      await expect(checkSoundCatalog(fixture)).rejects.toThrow('hash mismatch');
    }finally{await rm(fixture,{recursive:true,force:true});}
  },30000);
});
