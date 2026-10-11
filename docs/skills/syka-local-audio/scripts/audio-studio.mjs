/** Original Syka audio synthesis, MIT. Node standard library only; deterministic PCM. */
import { mkdir, writeFile, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const RATE = 48000;
export const EFFECTS = { pop: .24, click: .07, tap: .15, whoosh: .62, swipe: .32, impact: .85, riser: 1.8, downer: 1.2, chime: 1.5, success: .8, notification: .65, shimmer: 1.8 };
const TAU = Math.PI * 2;
const dbGain = db => 10 ** (db / 20);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const hz = note => 440 * 2 ** ((note - 69) / 12);
const smooth = u => { const x=clamp(u,0,1); return x*x*(3-2*x); };
function random(seed) { let state=seed>>>0; return () => { state=(Math.imul(state,1664525)+1013904223)>>>0; return state/4294967296; }; }
function channels(count) { return [new Float32Array(count),new Float32Array(count)]; }
function fadeEnds(samples, rate, fadeIn=.003, fadeOut=.04) {
  const count=samples[0].length;
  for(let i=0;i<count;i++) {
    const gain=smooth(i/(rate*fadeIn))*smooth((count-1-i)/(rate*fadeOut));
    for(const channel of samples) channel[i]*=gain;
  }
}
function normalize(samples, peakDb=-6) {
  let peak=0; for(const c of samples) for(const v of c) { if(!Number.isFinite(v))throw Error('Non-finite audio'); peak=Math.max(peak,Math.abs(v)); }
  const gain=peak?dbGain(peakDb)/peak:1;
  for(const c of samples) for(let i=0;i<c.length;i++)c[i]*=gain;
  return samples;
}
function finish(samples, peakDb, loop=false) {
  // Remove DC; smooth saturation bounds unusually coincident attacks before normalization.
  for(const c of samples) { let mean=0;for(const x of c)mean+=x;mean/=c.length;for(let i=0;i<c.length;i++)c[i]=Math.tanh(c[i]-mean); }
  if(!loop)fadeEnds(samples,RATE,.004,.065);
  return normalize(samples,peakDb);
}
export function synthEffect({kind='pop',variant=0,seed=7,duration=EFFECTS[kind],peakDb=-6}={}) {
  if(!(kind in EFFECTS))throw Error('Unknown effect');
  if(!Number.isFinite(duration)||duration<.04||duration>20||!Number.isSafeInteger(seed)||!Number.isInteger(variant)||variant<0||variant>8||!Number.isFinite(peakDb)||peakDb>0||peakDb< -60)throw Error('Invalid synthesis options');
  const samples=channels(Math.round(duration*RATE)),rng=random(seed),pitch=2**((variant-1)*2/12);
  let low=0,highLow=0,phase=0;
  for(let i=0;i<samples[0].length;i++) {
    const t=i/RATE,u=i/Math.max(1,samples[0].length-1),noise=rng()*2-1;
    const cutoff=kind==='whoosh'||kind==='swipe'?450+4200*Math.sin(Math.PI*u)**2:1800;
    low+=(1-Math.exp(-TAU*cutoff/RATE))*(noise-low);
    highLow+=(1-Math.exp(-TAU*160/RATE))*(noise-highLow);
    const band=low-highLow;
    let value=0;
    if(kind==='pop') {
      phase+=TAU*(125+310*Math.exp(-t/.027))*pitch/RATE;
      value=.78*Math.sin(phase)*Math.exp(-t/.05)+.11*band*Math.exp(-t/.012);
    } else if(kind==='click'||kind==='tap') {
      const decay=kind==='tap'?.024:.008;
      value=.55*band*Math.exp(-t/decay)+.35*Math.sin(TAU*760*pitch*t)*Math.exp(-t/(decay*.8));
    } else if(kind==='whoosh'||kind==='swipe') {
      const shape=Math.sin(Math.PI*u)**(kind==='swipe'?1.8:2.5);
      phase+=TAU*(95+220*u)*pitch/RATE;
      value=band*shape+.045*Math.sin(phase)*shape;
    } else if(kind==='impact') {
      phase+=TAU*(47+115*Math.exp(-t/.025))*pitch/RATE;
      value=.8*Math.sin(phase)*Math.exp(-t/.16)+.2*band*Math.exp(-t/.04);
    } else if(kind==='riser'||kind==='downer') {
      const rise=kind==='riser'?u:1-u;
      phase+=TAU*(110+820*rise*rise)*pitch/RATE;
      value=(.14*Math.sin(phase)+.45*band)*Math.sin(Math.PI*u)**.8;
    } else {
      const notes=kind==='success'?[72,76,79]:kind==='notification'?[72,79]:kind==='shimmer'?[79,84,88,91]:[72,76,79];
      for(let n=0;n<notes.length;n++) {
        const local=t-n*(kind==='shimmer'?.085:.095);
        if(local<0)continue;
        const f=hz(notes[n])*pitch,env=smooth(local/.006)*Math.exp(-local/(kind==='shimmer'?.55:.24));
        value+=env*(Math.sin(TAU*f*local)+.18*Math.sin(TAU*f*2.003*local)+.05*Math.sin(TAU*f*3.98*local))/notes.length;
      }
    }
    const pan=kind==='whoosh'||kind==='swipe'?Math.sin((u-.5)*Math.PI)*.55:Math.sin(u*TAU)*.12;
    samples[0][i]=value*Math.sqrt((1-pan)/2);
    samples[1][i]=value*Math.sqrt((1+pan)/2);
  }
  // Small stereo reflections give tonal cues a tail without smearing the contact.
  if(['chime','success','notification','shimmer'].includes(kind)) {
    const delay=Math.round(.071*RATE);
    for(let i=samples[0].length-1;i>=delay;i--) { samples[0][i]+=.12*samples[1][i-delay]; samples[1][i]+=.14*samples[0][i-delay]; }
  }
  return {samples:finish(samples,peakDb),rate:RATE,kind,seed,variant,duration:samples[0].length/RATE,loop:false};
}

function voice(stem, start, duration, frequency, type, gain, pan, rng) {
  const from=Math.round(start*RATE),count=Math.round(duration*RATE),gL=Math.sqrt((1-pan)/2)*gain,gR=Math.sqrt((1+pan)/2)*gain;
  let low=0,phase=0;
  for(let n=0;n<count;n++) {
    const i=from+n;if(i<0||i>=stem[0].length)continue;
    const t=n/RATE,u=n/Math.max(1,count-1);let v=0;
    if(type==='pad') {
      const env=smooth(t/.3)*smooth((duration-t)/.45);
      v=env*(Math.sin(TAU*frequency*t)+.32*Math.sin(TAU*frequency*1.0025*t)+.13*Math.sin(TAU*frequency*2*t));
    } else if(type==='pluck') {
      const env=smooth(t/.004)*Math.exp(-t/.24)*smooth((duration-t)/.09);
      v=env*(Math.sin(TAU*frequency*t)+.23*Math.sin(TAU*frequency*2*t)*Math.exp(-t/.09)+.1*Math.sin(TAU*frequency*3*t)*Math.exp(-t/.05));
    } else if(type==='bass') {
      v=smooth(t/.012)*smooth((duration-t)/.055)*Math.exp(-t/.48)*(Math.sin(TAU*frequency*t)+.12*Math.sin(TAU*frequency*2*t));
    } else if(type==='kick') {
      phase+=TAU*(48+95*Math.exp(-t/.023))/RATE;v=Math.sin(phase)*Math.exp(-t/.065)*smooth(t/.002)*smooth((duration-t)/.025);
    } else {
      const noise=rng()*2-1;low+=.12*(noise-low);
      v=(noise-low)*Math.exp(-t/(type==='hat'?.013:.045))*smooth(t/.001)*smooth(1-u);
      if(type==='snare')v=.5*v+.25*Math.sin(TAU*180*t)*Math.exp(-t/.03);
    }
    stem[0][i]+=v*gL;stem[1][i]+=v*gR;
  }
}
export function synthMusic({mood='warm',bpm=mood==='pulse'?116:mood==='ambient'?80:96,bars=8,seed=7,loop=false,peakDb=-9}={}) {
  if(!['warm','pulse','ambient'].includes(mood)||!Number.isFinite(bpm)||bpm<40||bpm>180||!Number.isInteger(bars)||bars<4||bars>32||!Number.isSafeInteger(seed)||!Number.isFinite(peakDb)||peakDb>0||peakDb< -60)throw Error('Invalid music options');
  const count=Math.round(bars*4*60/bpm*RATE),period=count/RATE,beat=period/(bars*4),rng=random(seed);
  const stems=Object.fromEntries(['harmony','melody','bass','drums'].map(name=>[name,channels(count*3)]));
  // Am(add9), Fmaj7, Cmaj9, Gsus: original arrangement, no sampled performances.
  const chords=[[57,60,64,71],[53,57,60,64],[48,55,59,62],[55,60,62,69]];
  for(let cycle=0;cycle<3;cycle++) for(let bar=0;bar<bars;bar++) {
    const start=cycle*period+bar*beat*4,chord=chords[Math.floor(bar/2)%4],energy=mood==='ambient'?.35:mood==='pulse'?1:.62;
    for(let n=0;n<chord.length;n++)voice(stems.harmony,start,beat*4+.4,hz(chord[n]+12),'pad',.032,n%2?.52:-.52,rng);
    for(let step=0;step<8;step++) {
      if(mood==='ambient'&&step%2||step===7&&bar%2===0)continue;
      const note=chord[(step+(bar%2))%chord.length]+24;
      voice(stems.melody,start+step*beat/2,Math.min(.95,beat*1.5),hz(note),'pluck',.068*(step%2?.7:1),step%2?.38:-.38,rng);
    }
    for(let b=0;b<4;b++) {
      voice(stems.bass,start+b*beat,beat*.88,hz(chord[0]-12),'bass',.09*energy,0,rng);
      if(mood==='ambient')continue;
      if(b===0||b===2||mood==='pulse')voice(stems.drums,start+b*beat,.25,0,'kick',.12*energy,0,rng);
      if(b%2===1)voice(stems.drums,start+b*beat,.17,0,'snare',.036*energy,-.1,rng);
      voice(stems.drums,start+b*beat+beat/2,.09,0,'hat',.024*energy,.38,rng);
    }
  }
  // Tempo-derived stereo delays. Keep the middle period to preserve looping tails.
  const delay=Math.round(beat*.75*RATE),melody=stems.melody;
  for(let i=melody[0].length-1;i>=delay;i--) { melody[0][i]+=.18*melody[1][i-delay];melody[1][i]+=.18*melody[0][i-delay]; }
  const sliced=Object.fromEntries(Object.entries(stems).map(([name,pair])=>[name,pair.map(c=>c.slice(count,count*2))]).filter(([,pair])=>pair.some(c=>c.some(v=>v!==0))));
  const mix=channels(count);
  for(const pair of Object.values(sliced))for(let c=0;c<2;c++)for(let i=0;i<count;i++)mix[c][i]+=pair[c][i];
  // Linear bus gain keeps exported stems reconstructable; no per-stem normalization.
  let peak=0;for(const c of mix)for(const v of c)peak=Math.max(peak,Math.abs(v));const gain=dbGain(peakDb)/Math.max(peak,1e-9);
  for(const pair of [...Object.values(sliced),mix]) {
    for(const c of pair)for(let i=0;i<count;i++)c[i]*=gain;
    if(!loop)fadeEnds(pair,RATE,.12,Math.min(1.2,beat*2));
  }
  return {samples:mix,stems:sliced,rate:RATE,duration:period,bpm,bars,seed,mood,kind:'music',loop};
}
export function measure(samples,rate=RATE) {
  let peak=0,sum=0,clipped=0;const frames=samples[0].length;
  for(const c of samples)for(const x of c) { if(!Number.isFinite(x))throw Error('Invalid sample');peak=Math.max(peak,Math.abs(x));sum+=x*x;if(Math.abs(x)>=1)clipped++; }
  return {duration:frames/rate,rate,channels:samples.length,frames,peakDb:20*Math.log10(Math.max(peak,1e-12)),rmsDb:10*Math.log10(Math.max(sum/(frames*samples.length),1e-24)),clippedSamples:clipped};
}
export function pcmWave(samples,rate=RATE) {
  const count=samples[0].length,channels=samples.length;if(channels<1||channels>2||samples.some(c=>c.length!==count))throw Error('Invalid channel layout');
  const data=Buffer.alloc(44+count*channels*2);data.write('RIFF',0);data.writeUInt32LE(data.length-8,4);data.write('WAVEfmt ',8);data.writeUInt32LE(16,16);data.writeUInt16LE(1,20);data.writeUInt16LE(channels,22);data.writeUInt32LE(rate,24);data.writeUInt32LE(rate*channels*2,28);data.writeUInt16LE(channels*2,32);data.writeUInt16LE(16,34);data.write('data',36);data.writeUInt32LE(data.length-44,40);
  let offset=44;for(let i=0;i<count;i++)for(const c of samples) { if(!Number.isFinite(c[i]))throw Error('Invalid sample');data.writeInt16LE(Math.round(clamp(c[i],-1,1)*32767),offset);offset+=2; }return data;
}
export async function saveAudio(path,result,{stems=false}={}) {
  path=resolve(path);if(!path.toLowerCase().endsWith('.wav'))throw Error('Output must end in .wav');
  const files=[{path,data:pcmWave(result.samples,result.rate)}];
  if(stems&&result.stems)for(const [name,samples] of Object.entries(result.stems))files.push({path:path.replace(/\.wav$/i,'-'+name+'.wav'),data:pcmWave(samples,result.rate)});
  const metadata={...measure(result.samples,result.rate),kind:result.kind,mood:result.mood,bpm:result.bpm,bars:result.bars,seed:result.seed,variant:result.variant,loop:result.loop,license:'MIT',generator:'Syka audio-studio',stems:files.slice(1).map(f=>f.path.split(/[\\/]/).pop())};
  files.push({path:path.replace(/\.wav$/i,'.json'),data:JSON.stringify(metadata,null,2)+'\n'});
  for(const file of files) {try {await access(file.path);}catch(error){if(error.code==='ENOENT')continue;throw error;}throw Error('Refusing to overwrite '+file.path);}
  await mkdir(dirname(path),{recursive:true});for(const file of files)await writeFile(file.path,file.data,{flag:'wx'});return {path,...metadata};
}
async function main() {
  const args={};for(let i=2;i<process.argv.length;i++) {const key=process.argv[i];if(['--loop','--stems'].includes(key)){args[key.slice(2)]=true;continue;}if(!key.startsWith('--')||!process.argv[i+1]||process.argv[i+1].startsWith('--'))throw Error('Expected --option value');args[key.slice(2)]=process.argv[++i];}
  const allowed=['kind','mood','bpm','bars','seed','variant','duration','peak-db','output','loop','stems'];if(Object.keys(args).some(k=>!allowed.includes(k))||!args.output||!args.kind)throw Error('Use --kind pop|whoosh|music --output file.wav, optionally --mood warm|pulse|ambient --bpm 96 --bars 8 --seed 7 --loop --stems');
  const number=key=>args[key]===undefined?undefined:Number(args[key]);
  const result=args.kind==='music'?synthMusic({mood:args.mood,bpm:number('bpm'),bars:number('bars'),seed:number('seed'),loop:!!args.loop,peakDb:number('peak-db')}):synthEffect({kind:args.kind,duration:number('duration'),variant:number('variant'),seed:number('seed'),peakDb:number('peak-db')});
  console.log(JSON.stringify(await saveAudio(args.output,result,{stems:!!args.stems})));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(error=>{console.error(error.message);process.exitCode=1;});
