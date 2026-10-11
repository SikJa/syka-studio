import {spawn} from 'node:child_process';
import {mkdir,realpath,stat,unlink} from 'node:fs/promises';
import {isAbsolute,join,relative,sep} from 'node:path';
import {randomUUID} from 'node:crypto';

export const AUDIO_TOOLS=[{type:'function',name:'syka_audio_enhance',description:'Enhance existing audio/video locally using FFmpeg. Gentle uses light 6 dB noise reduction and a 70 Hz high-pass; speech adds EQ/compression. Both use measured two-pass normalization to -18 LUFS / -2 dBTP for comparison and mix headroom. Saves a separate 48 kHz / 24-bit WAV in the project. Preserves the original. Not neural voice isolation or music/voice generation. Use only when audio enhancement is requested; compare by listening.',inputSchema:{type:'object',properties:{source:{type:'string'},profile:{type:'string',enum:['gentle','speech']}},required:['source'],additionalProperties:false}}];

export function cleanupFilter(profile: 'gentle' | 'speech') {
  return profile==='speech'
    ? 'highpass=f=80,afftdn=nr=10:nf=-35:tn=1,equalizer=f=250:t=q:w=1:g=-2,equalizer=f=3000:t=q:w=1:g=1.5,acompressor=threshold=0.16:ratio=2:attack=15:release=180'
    : 'highpass=f=70,afftdn=nr=6:nf=-40:tn=1';
}
type Measurement = {input_i:number;input_tp:number;input_lra:number;input_thresh:number;target_offset:number};
export function readLoudnessMeasurement(stderr: string): Measurement {
  const blocks=stderr.match(/\{[^{}]*"input_i"[^{}]*\}/g);
  if(!blocks?.length) throw Error('FFmpeg no devolvió la medición de volumen.');
  const raw=JSON.parse(blocks[blocks.length-1]!);
  const measurement={} as Measurement;
  for(const key of ['input_i','input_tp','input_lra','input_thresh','target_offset'] as const) {
    const value=Number(raw[key]);
    if(raw[key]===null || raw[key]===undefined || raw[key]==='' || !Number.isFinite(value))
      throw Error('No se pudo medir una señal audible. No se normalizó el silencio.');
    measurement[key]=value;
  }
  return measurement;
}
function run(binary:string,args:string[]):Promise<string> {
  return new Promise((resolve,reject)=>{
    const child=spawn(binary,args,{windowsHide:true,stdio:['ignore','ignore','pipe']});let stderr='';
    const timer=setTimeout(()=>{child.kill();reject(Error('La limpieza de audio superó diez minutos. Probá con un tramo más corto.'));},600000);
    child.stderr.on('data',d=>stderr=(stderr+String(d)).slice(-12000));
    child.on('error',error=>{clearTimeout(timer);reject(error)});
    child.on('close',code=>{clearTimeout(timer);code===0?resolve(stderr):reject(Error(stderr||'FFmpeg failed '+code))});
  });
}
export async function enhanceAudio(cwd:string,binary:string|undefined,raw:unknown){
  const a=raw as {source?:string;profile?:string};
  if(!a||typeof a.source!=='string'||!isAbsolute(a.source))throw Error('Source must be an absolute local media path; resolve library assets first');
  if(a.profile && !['gentle','speech'].includes(a.profile))throw Error('Unknown audio profile');
  if(!binary)throw Error('FFmpeg is not configured');
  await realpath(binary);const source=await realpath(a.source);
  if(!(await stat(source)).isFile())throw Error('Media source is not a file');
  const root=await realpath(cwd),folder=join(root,'03 Assets reutilizables','Audio mejorado');await mkdir(folder,{recursive:true});
  const outRoot=await realpath(folder),rel=relative(root,outRoot);
  if(isAbsolute(rel)||rel==='..'||rel.startsWith('..'+sep))throw Error('Output folder escapes project');
  const path=join(outRoot,'audio-'+randomUUID()+'.wav'),profile=(a.profile??'gentle') as 'gentle'|'speech';
  const clean=cleanupFilter(profile),target='loudnorm=I=-18:TP=-2:LRA=9';
  const input=['-nostdin','-n','-hide_banner','-i',source,'-map','0:a:0','-vn'];
  const measured=readLoudnessMeasurement(await run(binary,[...input,'-af',clean+','+target+':print_format=json','-f','null','-']));
  const normalize=`${target}:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}:linear=true:print_format=json`;
  try {
    await run(binary,[...input,'-af',clean+','+normalize,'-ar','48000','-c:a','pcm_s24le',path]);
  } catch(error) {
    // Only this newly generated UUID output is discarded if FFmpeg left a partial file.
    await unlink(path).catch(()=>undefined);throw error;
  }
  return {path,source,profile,bytes:(await stat(path)).size,originalPreserved:true,
    processing:{noiseReductionDb:profile==='gentle'?6:10,normalization:'measured-two-pass',targetLufs:-18,truePeakLimitDb:-2,sampleRate:48000,bitDepth:24},
    note:'Limpieza local suave; no separación neural. Compará el resultado con el original antes de sustituir la pista.'};
}
