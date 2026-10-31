/* Earshot launch mix/placement adapter. Based on Earshot 0.4 (MIT),
 * Copyright (c) 2026 Leon Lin. Original license ships with the frozen kit.
 * Native JSX/project integration: Syka, MPL-2.0. No Python or models here. */
import { createHash, randomInt, randomUUID } from 'node:crypto';
import { mkdir, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, isAbsolute, join, relative, sep } from 'node:path';
import { analysisSource, mediaProcess } from './media-analysis';
import type { ToolSearch } from './local-tools';

export const LAUNCH_ROLES = ['tick','tick.crisp','tock','hit','land','land.light','pop','whoosh.short','whoosh.long','riser','swell','drop','key','key.space','key.return','click','click.confirm','snap','bell','text'] as const;
type Take = {file:string;sha256:string;checks:string[];seed:number;pitch:string|number|null;onset_s:number;peak_s:number;end_s:number;dur_s:number;peak_db:number;l50_lufs:number;corr:number};
type Role = {sound:string;align:'onset'|'peak'|'end';level_db:number;bed_db:number;offset_ms:number;min_gap_ms?:number;width?:number;takes:Take[]};
type Kit = {earshot:string;sr:number;source:{commit:string;modelsLoaded:boolean};roles:Record<string,Role|null>;mix:{stop_down:{before:string[];depth_db:number[];length_s:number[]}}};
type Cue = {id:string;role:typeof LAUNCH_ROLES[number];seconds:number;take?:number};
const schema=(properties:Record<string,unknown>,required:string[])=>({type:'object',additionalProperties:false,properties,required});
export const EARSHOT_LAUNCH_TOOL = {type:'function',name:'syka_launch_audio',
  description:'Earshot 0.4 launch kit: create portable, measured SFX takes and a native editable Audio component for the actual visual event cues. No Python, neural models or network. Preserves per-role onset/peak alignment, small timing offsets, run spacing, baked stereo width and deterministic variants. Optional real local bed permits K-weighted relative gain; includeBed:true also creates ONE native music track with optional pre-hit stop-down (not sidechain ducking). Returns componentImport/componentJSX: insert them into the active scene using source tools, then verify native timeline and export. Never overwrites a composition or replaces approved music. Status lists roles without creating files. Effects must follow actual actions, not arbitrary density.',
  inputSchema:schema({action:{type:'string',enum:['status','create']},duration:{type:'number',minimum:1,maximum:180},seed:{type:'integer',minimum:0,maximum:4294967295},
    bed:{type:'string',description:'Local music-only file inside project; timeline starts at zero, rate 1.'},bedVolumeDb:{type:'number',minimum:-60,maximum:12},bedSourceIn:{type:'number',minimum:0},includeBed:{type:'boolean'},stopDown:{type:'boolean',description:'Requires includeBed. Editable pre-hit music attenuation, released on visual hit.'},
    cues:{type:'array',minItems:1,maxItems:32,items:schema({id:{type:'string'},role:{type:'string',enum:[...LAUNCH_ROLES]},seconds:{type:'number',minimum:0},take:{type:'integer',minimum:0}},['id','role','seconds'])}},['action'])};

const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const round=(n:number)=>Math.round(n*10000)/10000;
const within=(root:string,path:string)=>{const rel=relative(root,path);return !isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+sep);};
const num=(n:unknown,low:number,high:number,label:string)=>{if(typeof n!=='number'||!Number.isFinite(n)||n<low||n>high)throw Error(label+' fuera de rango.');return n;};

/** ITU-R BS.1770 at 48 kHz; equivalent to upstream kit.bed_level, no model. */
export function launchBedLevel(pcm:Buffer) {
  const frames=pcm.length/8,win=2400,blocks=Math.floor(frames/win);
  if(!Number.isInteger(frames)||blocks<1)return null;
  const sums=new Float64Array(blocks);
  const filters=[[1.53512485958697,-2.69169618940638,1.19839281085285,-1.69065929318241,.73248077421585],[1,-2,1,-1.99004745483398,.99007225036621]];
  for(let ch=0;ch<2;ch++) {
    const state=filters.map(()=>[0,0]);
    for(let i=0;i<blocks*win;i++) {
      let x=pcm.readFloatLE(i*8+ch*4);
      if(!Number.isFinite(x))throw Error('PCM no finito.');
      for(let f=0;f<filters.length;f++) {const [b0,b1,b2,a1,a2]=filters[f]!,z=state[f]!;const y=b0!*x+z[0]!;z[0]=b1!*x-a1!*y+z[1]!;z[1]=b2!*x-a2!*y;x=y;}
      sums[Math.floor(i/win)]!+=x*x/win;
    }
  }
  const sorted=[...sums].sort((a,b)=>a-b),mid=Math.floor(blocks/2),power=blocks%2?sorted[mid]!:(sorted[mid-1]!+sorted[mid]!)/2;
  const level=Math.round((-0.691+10*Math.log10(power+1e-24))*100)/100;
  return level < -60 ? null : level;
}
export function launchGain(take:Pick<Take,'peak_db'|'l50_lufs'>,role:Pick<Role,'level_db'|'bed_db'>,bed:number|null) {
  const gain=bed!==null&&bed>=-60?bed+10*Math.log10(10**(role.bed_db/10)-1)-take.l50_lufs:role.level_db;
  return Math.round(Math.min(12,-1-take.peak_db,Math.max(-96,gain))*100)/100;
}
export function launchPlace(take:Take,role:Role,seconds:number) {return round(seconds+role.offset_ms/1000-take[(role.align+'_s') as 'onset_s'|'peak_s'|'end_s']);}

/** Lowest of overlapping pre-hit dips; points use source time when serialized. */
export function launchStopPoints(duration:number,base:number,hits:number[],length=.4,depth=9) {
  const dips=hits.filter(t=>t>0&&t<=duration).map(end=>({start:Math.max(0,end-length),end}));
  const at=(t:number)=>base-Math.max(0,...dips.map(d=>t>=d.start&&t<d.end?depth*Math.min(1,(t-d.start)/Math.min(.035,d.end-d.start)):0));
  const times=[0,duration,...dips.flatMap(d=>[d.start,Math.min(d.end,d.start+.035),Math.max(d.start,d.end-.004),d.end])];
  return [...new Set(times.map(round))].sort((a,b)=>a-b).map(time=>({time,value:round(at(time))}));
}

async function readKit(docs:string|undefined) {
  if(!docs)throw Error('Kit launch no disponible en esta instalación.');
  const docsRoot=await realpath(docs),root=await realpath(join(docsRoot,'skills/syka-local-audio/resources/earshot-launch'));
  if(!within(docsRoot,root))throw Error('Kit fuera de recursos.');
  const kit=JSON.parse(await readFile(join(root,'kit.lock.json'),'utf8')) as Kit;
  if(kit.earshot!=='0.4.0'||kit.sr!==48000||kit.source?.modelsLoaded!==false)throw Error('Kit launch incompatible.');
  return {kit,root};
}
async function safeOutput(cwd:string,scope:'audio'|'source'='audio') {
  const root=await realpath(cwd),parent=scope==='source'?join(root,'components'):join(root,'03 Assets reutilizables','Audio');let check=parent;
  while(true){try{if(!within(root,await realpath(check)))throw Error('Salida fuera del proyecto.');break;}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;check=dirname(check);}}
  await mkdir(parent,{recursive:true});if(!within(root,await realpath(parent)))throw Error('Salida fuera del proyecto.');
  const folder=join(parent,'Earshot-launch-'+randomUUID());await mkdir(folder);
  const actual=await realpath(folder);if(!within(root,actual))throw Error('Salida fuera del proyecto.');
  return {project:root,folder:actual};
}

export async function createLaunchAudio(cwd:string,docs:string|undefined,raw:unknown,search?:ToolSearch,signal?:AbortSignal) {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Argumentos de launch requeridos.');
  const args=raw as Record<string,unknown>;
  if(Object.keys(args).some(k=>!['action','duration','seed','bed','bedVolumeDb','bedSourceIn','includeBed','stopDown','cues'].includes(k)))throw Error('Campo launch desconocido.');
  const {kit,root:kitRoot}=await readKit(docs);
  if(args.action==='status')return {version:kit.earshot,modelsRequired:false,roles:LAUNCH_ROLES.map(name=>({role:name,sound:kit.roles[name]?.sound,takes:kit.roles[name]?.takes.length,align:kit.roles[name]?.align})),analysis:'Optional separate syka_earshot_analyze; no automatic model loading.'};
  if(args.action!=='create')throw Error('Usá status o create.');
  const duration=num(args.duration,1,180,'duration'),seed=num(args.seed??randomInt(0,4294967296),0,4294967295,'seed');
  if(!Number.isInteger(seed))throw Error('seed debe ser entero.');
  for(const key of ['includeBed','stopDown'])if(args[key]!==undefined&&typeof args[key]!=='boolean')throw Error(key+' debe ser booleano.');
  if(args.stopDown&&!args.includeBed)throw Error('stopDown necesita includeBed para generar automatización nativa.');
  if((args.includeBed||args.bedVolumeDb!==undefined||args.bedSourceIn!==undefined)&&!args.bed)throw Error('Falta el archivo de música real.');
  if(!Array.isArray(args.cues)||!args.cues.length||args.cues.length>32)throw Error('Elegí 1–32 cues reales.');
  const ids=new Set<string>();
  const cues=args.cues.map((c:unknown)=>{
    if(!c||typeof c!=='object'||Array.isArray(c))throw Error('Cue inválido.');
    const row=c as Cue;
    if(Object.keys(row).some(k=>!['id','role','seconds','take'].includes(k))||typeof row.id!=='string'||!/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(row.id)||ids.has(row.id)||!LAUNCH_ROLES.includes(row.role))throw Error('ID único y rol launch requeridos.');
    ids.add(row.id);num(row.seconds,0,duration-.001,'cue.seconds');
    if(row.take!==undefined)num(row.take,0,kit.roles[row.role]!.takes.length-1,'take');
    if(row.take!==undefined&&!Number.isInteger(row.take))throw Error('take debe ser entero.');
    return {...row};
  }).sort((a,b)=>a.seconds-b.seconds);
  const volume=num(args.bedVolumeDb??0,-60,12,'bedVolumeDb'),sourceIn=num(args.bedSourceIn??0,0,86400,'bedSourceIn');
  const bed=args.bed?await analysisSource(cwd,args.bed,search):null;
  if(bed) {
    const probe=JSON.parse((await mediaProcess(bed.ffprobe,['-v','error','-show_streams','-show_format','-of','json',bed.path],100000,15000,signal)).stdout.toString());
    const stream=probe.streams?.find((s:{codec_type:string})=>s.codec_type==='audio');
    const length=Number(stream?.duration??probe.format?.duration);
    if(!stream||!Number.isFinite(length)||length<sourceIn+duration-.01)throw Error('La música no cubre el tramo solicitado. Prepará la sección/loop antes de crear el kit.');
    if(args.includeBed&&((await stat(bed.path)).size>128*1024*1024||!/^\.[a-z0-9]{1,8}$/i.test(extname(bed.path))))throw Error('Prepará un archivo de música de hasta 128 MiB con extensión de audio.');
  }
  const last=new Map<string,number>(),counts=new Map<string,number>(),rows=[];
  const warnings:string[]=[];
  for(const cue of cues) {
    signal?.throwIfAborted();
    const role=kit.roles[cue.role]!,count=counts.get(cue.role)??0;counts.set(cue.role,count+1);
    const seconds=round(Math.max(cue.seconds,(last.get(cue.role)??-Infinity)+(role.min_gap_ms??0)/1000));last.set(cue.role,seconds);
    if(seconds>=duration||seconds-cue.seconds>.15)throw Error('Run demasiado denso: agrupá los gestos de '+cue.role+' en el mapa de eventos.');
    const takeIndex=cue.take??(seed+count)%role.takes.length,take=role.takes[takeIndex]!;
    if(!/^[a-zA-Z0-9_.-]+\.wav$/.test(take.file)||!take.sha256||take.checks.length)throw Error('Take launch inválido.');
    const path=await realpath(join(kitRoot,take.file));if(!within(kitRoot,path))throw Error('Take fuera del kit.');
    const bytes=await readFile(path);if(sha(bytes)!==take.sha256)throw Error('Take launch cambió.');
    let level:number|null=null;
    if(bed&&seconds>=.05) {
      const from=sourceIn+Math.max(0,seconds-1),span=sourceIn+seconds-from;
      const pcm=await mediaProcess(bed.ffmpeg,['-nostdin','-v','error','-ss',String(from),'-i',bed.path,'-t',String(span),'-vn','-map','0:a:0','-ar','48000','-ac','2','-c:a','pcm_f32le','-f','f32le','-'],400000,15000,signal);
      const measured=launchBedLevel(pcm.stdout);level=measured===null?null:measured+volume;
    }
    const placed=launchPlace(take,role,seconds),start=Math.max(0,placed),trim=Math.max(0,-placed),end=Math.min(duration,placed+take.dur_s);
    if(end<=start)throw Error('El evento no deja señal audible dentro de la escena: '+cue.id);
    rows.push({id:cue.id,role:cue.role,requestedSeconds:cue.seconds,audioCueSeconds:seconds,take:takeIndex,sound:role.sound,pitch:take.pitch,seed:take.seed,file:take.file,sha256:take.sha256,align:role.align,offsetMs:role.offset_ms,stereoCorrelation:take.corr,bedLufs:level,volume:launchGain(take,role,level),start:round(start),end:round(end),sourceIn:round(trim),sourceOut:round(trim+end-start),syncPointSeconds:take[(role.align+'_s') as 'onset_s'|'peak_s'|'end_s'],bytes});
  }
  if((counts.get('riser')??0)>2||(counts.get('swell')??0)>1)warnings.push('Launch suele necesitar como máximo uno o dos risers y un swell: escuchá la densidad.');
  const {project,folder}=await safeOutput(cwd);
  let sourceFolder:string|undefined;
  try {
    signal?.throwIfAborted();
    sourceFolder=(await safeOutput(cwd,'source')).folder;
    const base=relative(project,folder).split(sep).join('/'),stem='earshot-'+randomUUID().slice(0,8);
    const json=(s:unknown)=>JSON.stringify(s);
    for(const file of new Map(rows.map(r=>[r.file,r])).values())await writeFile(join(folder,file.file),file.bytes,{flag:'wx'});
    for(const name of ['LICENSE.txt','CREDITS_FIT.md','launch.json'])await writeFile(join(folder,name),await readFile(join(kitRoot,name)),{flag:'wx'});
    const native=rows.map(r=>`    <audio id=${json(stem+'-'+r.id)} name=${json('Earshot · '+r.role+' · '+r.id)} src=${json(base+'/'+r.file)} start={${r.start}} end={${r.end}} sourceIn={${r.sourceIn}} sourceOut={${r.sourceOut}} volume={${r.volume}} />`);
    let points:{time:number;value:number}[]=[];
    if(args.includeBed&&bed) {
      const music=await readFile(bed.path);await writeFile(join(folder,'music'+extname(bed.path)),music,{flag:'wx'});
      const src=base+'/music'+extname(bed.path);
      points=args.stopDown?launchStopPoints(duration,volume,rows.filter(r=>kit.mix.stop_down.before.includes(r.role)).map(r=>r.audioCueSeconds)):[];
      native.unshift(`    <audio id=${json(stem+'-music')} name="Música · launch" src=${json(src)} start={0} end={${duration}} sourceIn={${sourceIn}} sourceOut={${sourceIn+duration}} volume={${volume}}>${points.length?'\n      <keyframeTrack property="volume">\n'+points.map(p=>`        <keyframe time={${round(sourceIn+p.time)}} value={${p.value}} easing="linear" />`).join('\n')+'\n      </keyframeTrack>\n    ':''}</audio>`);
    }
    const component='export function EarshotLaunchAudio() {\n  return <>\n'+native.join('\n')+'\n  </>;\n}\n';
    await writeFile(join(sourceFolder,'EarshotLaunchAudio.tsx'),component,{flag:'wx'});
    const plan={version:'earshot-launch-0.4',source:kit.source,seed,duration,bed:bed?.projectPath??null,bedVolumeDb:volume,bedSourceIn:sourceIn,includeBed:Boolean(args.includeBed),stopDown:Boolean(args.stopDown),musicEnvelope:points,cues:rows.map(({bytes,...r})=>r),warnings,requiresListening:true,modelsLoaded:false};
    await writeFile(join(folder,'launch-plan.json'),JSON.stringify(plan,null,2)+'\n',{flag:'wx'});
    const componentBase=relative(project,sourceFolder).split(sep).join('/');
    return {state:'created',component:componentBase+'/EarshotLaunchAudio.tsx',componentImport:`import { EarshotLaunchAudio } from ${json('./'+componentBase+'/EarshotLaunchAudio')};`,componentJSX:'<EarshotLaunchAudio />',assetsDirectory:base,plan:base+'/launch-plan.json',seed,cues:plan.cues.map(({id,role,start,end,volume,take})=>({id,role,start,end,volume,take})),warnings,requiresListening:true,modelsLoaded:false,next:'Insert componentImport and componentJSX in the active native scene using source tools; it creates separate editable audio nodes in the timeline. Import path is relative to the project root: adjust for a nested composition file. If includeBed:true remove/replace the existing copy of that same music track to avoid doubling. Review actual mix with syka_audio_review. No composition was modified by this file-preparation call.'};
  } catch(error) {await rm(folder,{recursive:true,force:true});if(sourceFolder)await rm(sourceFolder,{recursive:true,force:true});throw error;}
}
