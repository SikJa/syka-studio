import { describe, it, expect } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { audioEnvelope } from '../../../docs/skills/syka-local-audio/examples/audio-envelope';
// @ts-expect-error The portable Node script is deliberately dependency-free JavaScript.
import { synthEffect, synthMusic, pcmWave, measure, saveAudio } from '../../../docs/skills/syka-local-audio/scripts/audio-studio.mjs';

describe('original audio synthesis',()=>{
  it('reproduces seeded sound and makes distinct timbres without clipping',()=>{
    const options={kind:'whoosh',seed:41,variant:1};
    const a=synthEffect(options),b=synthEffect(options),c=synthEffect({...options,seed:42});
    expect(pcmWave(a.samples).equals(pcmWave(b.samples))).toBe(true);
    expect(pcmWave(a.samples).equals(pcmWave(c.samples))).toBe(false);
    expect(measure(a.samples).clippedSamples).toBe(0);
    expect(Math.abs(a.samples[0][0])).toBe(0);expect(Math.abs(a.samples[0].at(-1))).toBe(0);
    expect(pcmWave(a.samples).readUInt16LE(22)).toBe(2);
  });
  it('keeps musical stems additive and the loop seam continuous',()=>{
    const result=synthMusic({mood:'warm',bars:4,bpm:120,loop:true});
    expect(measure(result.samples).duration).toBe(8);
    for(let channel=0;channel<2;channel++){
      for(const index of [0,431,100000,383999]){
        const reconstructed=Object.values(result.stems).reduce((sum:number,pair:any)=>sum+pair[channel][index],0);
        expect(reconstructed).toBeCloseTo(result.samples[channel][index],6);
      }
      expect(Math.abs(result.samples[channel][0]-result.samples[channel].at(-1))).toBeLessThan(.02);
    }
    expect(measure(result.samples).clippedSamples).toBe(0);
  });
  it('refuses invalid duration/tempo and never overwrites an existing output',async()=>{
    expect(()=>synthEffect({kind:'pop',duration:NaN})).toThrow();
    expect(()=>synthMusic({bpm:0})).toThrow();
    const root=await mkdtemp(join(tmpdir(),'syka-sound-test-'));
    try{
      const path=join(root,'sound.wav');await saveAudio(path,synthEffect());const original=await readFile(path);
      await expect(saveAudio(path,synthEffect({kind:'impact'}))).rejects.toThrow('overwrite');
      expect(await readFile(path)).toEqual(original);
    } finally { if(!root.startsWith(join(tmpdir(),'syka-sound-test-')))throw Error('Bad fixture');await rm(root,{recursive:true,force:true}); }
  });
});
describe('native editable music ducking',()=>{
  it('ducks during speech, recovers after it and uses source time after trim/rate',()=>{
    const points=audioEnvelope({duration:8,start:10,sourceIn:2,playbackRate:2,speech:[{start:12,end:14}],fadeIn:0,fadeOut:0});
    expect(points.find(p=>p.timelineTime===12)).toMatchObject({sourceTime:6,volumeDb:-27});
    expect(points.find(p=>p.timelineTime===14.43)?.volumeDb).toBeCloseTo(-16);
    expect(points.at(-1)?.sourceTime).toBe(18);
  });
  it('avoids pumping through a short speech gap and does not mutate input',()=>{
    const speech=[{start:1,end:2},{start:2.1,end:3}];const original=JSON.stringify(speech);
    const points=audioEnvelope({duration:5,speech});
    expect(points.some(p=>p.timelineTime>2&&p.timelineTime<2.1&&p.volumeDb> -27)).toBe(false);
    expect(JSON.stringify(speech)).toBe(original);
    expect(points[0].volumeDb).toBeLessThan(-70);expect(points.at(-1)!.volumeDb).toBeLessThan(-70);
  });
  it('rejects nonfinite timing and invalid playback rates before producing keyframes',()=>{
    expect(()=>audioEnvelope({duration:8,playbackRate:0})).toThrow();
    expect(()=>audioEnvelope({duration:8,speech:[{start:2,end:NaN}]})).toThrow();
  });
});
