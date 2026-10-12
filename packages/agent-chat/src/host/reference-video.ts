import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile,realpath,readdir,lstat,stat,rm,copyFile} from 'node:fs/promises';
import {join,relative,isAbsolute,sep} from 'node:path';
import type {ToolImage} from '../protocol';
import {killTree} from './env';
import {videoDownloadError} from './video-download-error';
import {parseVideoToolJson, VideoToolOutput, YTDLP_METADATA_ARGS, YTDLP_FFMPEG_NETWORK_ARGS, youtubeSectionFormat} from './yt-dlp';
import {addStorageJobOwner,createStorageJob,finishStorageJob,moveToStorageTrash,settleStorageOwners} from './storage-ledger';

export const REFERENCE_VIDEO_TOOL={type:'function',name:'syka_reference_video',description:'Watch-style local evidence from a public Instagram, TikTok, X/Twitter, YouTube/Shorts URL or an existing local video. Briefly inspect representative frames before asking about an unspecified purpose; recommend a direction grounded in what you actually saw, then wait for syka_ask_user before deeper analysis or editing. For this initial pass set initialInspection: true; it clamps the excerpt to at most 20 seconds and four frames, without preparing audio or retaining the source. analyze downloads temporarily, returns timestamped frame images to vision and persists a small reference manifest in the project. The downloaded source is removed in finally; local originals are never deleted. includeAudio prepares a playable MP3 for requested speech/music analysis; use media_transcribe for real speech timestamps. keepSource is opt-in to retain an editable source when explicitly needed. Never insert music/video into the timeline without a preview and placement answer. Public only, no automatic cookies/login. Long sources require start/end (max 10 min). read reopens persisted evidence; release removes only the disposable source; dispose removes this reference evidence only if the user explicitly asks.',inputSchema:{type:'object',properties:{action:{type:'string',enum:['analyze','read','release','dispose']},source:{type:'string'},initialInspection:{type:'boolean',description:'Bounded visual first look: up to 20 seconds from start (default 0), four frames, no prepared audio or retained source. Not an approved edit range.'},focus:{type:'string',description:'Specific inspection scope: a bounded initial visual inspection, or the aspect already specified by the user. An initial scope is not a chosen creative goal.'},id:{type:'string'},start:{type:'number',minimum:0},end:{type:'number',exclusiveMinimum:0},includeAudio:{type:'boolean'},keepSource:{type:'boolean'},frames:{type:'integer',minimum:2,maximum:24}},required:['action'],additionalProperties:false}};
export const REFERENCE_VIDEO_INSTRUCTIONS='Video reference contract (persistent): for a bare video link or generic "analyze this", first briefly inspect real representative frames, then ALWAYS call syka_ask_user with observed context and a concrete recommended direction before deeper analysis or production. Reuse read evidence where available. For an initial pass set initialInspection: true and describe its visual scope in focus; the tool limits it to four frames and at most 20 seconds, clamped to duration; this sampling range is not an approved edit range. Do not transcribe an entire long video or retain its source just to formulate a question. Ask naturally what they want to achieve and what matters; voice, music, text, captions, motion and pacing are examples, not a closed intent filter. Read previous explicit answers so you do not ask again. With an explicit aspect use syka_reference_video, inspect EVERY returned image, and distinguish observed frames from unsampled intervals. For voice/subtitles transcribe its audioPath with media_transcribe, never infer words from images. For music show the returned playable audio preview for user listening. Do not claim to have heard or identified music unless the current provider actually receives and understands audio; transcription does not describe music. Before inserting music or source footage, show a preview and ask exactly where in the current composition to place it. analyze keeps frames/source URL/manifest so the reference is reopenable for weeks without retaining a downloaded video cache. keepSource only if a full source is explicitly needed for later editing; it then becomes a durable project asset. Public platforms can still reject anonymous downloads: report the actual error and offer a local upload or explicit connection, never borrow browser cookies or silently route through another account/service. No auto-export.';
type Tools={ytDlp?:string;ffmpeg?:string;ffprobe?:string;node?:string;env?:Record<string,string>};
export type ReferenceManifest={version:1;id:string;source:string;focus:string;createdAt:string;duration:number;sourceStart:number;frames:{path:string;time:number}[];audioPath?:string;sourcePath?:string;temporarySourceRemoved:boolean;sampling:string};
const within=(root:string,path:string)=>{const r=relative(root,path);return !!r&&!isAbsolute(r)&&r!=='..'&&!r.startsWith('..'+sep)};
export function publicVideoUrl(raw:string):{url:string;platform:string}|null {
 try {const u=new URL(raw.trim());if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.port)return null;
  const h=u.hostname.toLowerCase(),p=u.pathname;
  let platform:string|undefined;
  if(['instagram.com','www.instagram.com'].includes(h)&&/^\/(?:p|reel|reels|tv)\/[\w-]+\/?$/.test(p))platform='instagram';
  if(['tiktok.com','www.tiktok.com','m.tiktok.com'].includes(h)&&/^\/@[^/]+\/video\/\d+\/?$/.test(p)||['vm.tiktok.com','vt.tiktok.com'].includes(h)&&/^\/[\w-]+\/?$/.test(p))platform='tiktok';
  if(['x.com','www.x.com','twitter.com','www.twitter.com','mobile.twitter.com'].includes(h)&&/^\/(?:[^/]+\/status|i\/status)\/\d+(?:\/video\/\d+)?\/?$/.test(p))platform='x';
  if(h==='youtu.be'&&/^\/[\w-]{11}\/?$/.test(p)||['youtube.com','www.youtube.com','m.youtube.com'].includes(h)&&(p==='/watch'&&/^[\w-]{11}$/.test(u.searchParams.get('v')??'')||/^\/(?:shorts|live|embed)\/[\w-]{11}\/?$/.test(p)))platform='youtube';
  if(!platform)return null;
  u.protocol='https:';const videoId=u.searchParams.get('v');u.search='';u.hash='';if(platform==='youtube'&&p==='/watch')u.searchParams.set('v',videoId!);
  return{url:u.toString(),platform};
 }catch{return null}
}
export class ReferenceVideos {
 private children=new Set<ReturnType<typeof spawn>>();
 private busy=false;
 private cancelled=false;
 private readonly cwd:string;
 private readonly tools:Tools;
 private storageJobId:string|undefined;
 private storageRuntime(){return process.env.SYKA_RUNTIME_ROOT;}
 constructor(cwd:string,tools:Tools){this.cwd=cwd;this.tools=tools;}
 async close(){this.cancelled=true;await Promise.allSettled([...this.children].map(child=>killTree(child)));}
 private async run(binary:string|undefined,args:string[],timeout=120000,json=false):Promise<string>{
  if(!binary)throw Error('Falta una herramienta local: necesitás yt-dlp, FFmpeg y FFprobe configurados.');
  if(this.cancelled)throw Error('Análisis de referencia cancelado.');
  return new Promise((resolve,reject)=>{const child=spawn(binary,args,{windowsHide:true,env:this.tools.env,stdio:['ignore','pipe','pipe']});this.children.add(child);const out=new VideoToolOutput(json);let err='',expired=false;
   if(this.storageJobId)void addStorageJobOwner(this.storageRuntime(),this.storageJobId,child.pid).catch(()=>{});
   const timer=setTimeout(()=>{expired=true;void killTree(child)},timeout);timer.unref();
   child.stdout!.setEncoding('utf8');child.stderr!.setEncoding('utf8');
   child.stdout!.on('data',d=>out.append(String(d)));child.stderr!.on('data',d=>err=(err+String(d)).slice(-8000));
   child.on('error',e=>{clearTimeout(timer);this.children.delete(child);reject(e)});
   child.on('close',code=>{clearTimeout(timer);this.children.delete(child);if(code!==0||this.cancelled||expired){reject(Error(this.cancelled?'Análisis de referencia cancelado.':expired?'La referencia tardó demasiado. Probá con un tramo más corto.':this.friendlyError(err||'La herramienta local falló.')));return;}try{resolve(out.read())}catch(error){reject(error)}});
  });
 }
 private friendlyError(raw:string){return videoDownloadError(raw);}
 private async roots(){const root=await realpath(this.cwd),folder=join(root,'03 Assets reutilizables','Referencias');await mkdir(folder,{recursive:true});const actual=await realpath(folder);if(!within(root,actual))throw Error('La carpeta de referencias sale del proyecto.');await this.recoverDownloads(actual);return{root,folder:actual};}
 private async recoverDownloads(root:string){
  // Desktop retention belongs to StorageService, which honors the configured
  // deadline and checks every owner PID. The CLI fallback must not evict its
  // downloads early merely because another reference is being opened.
  if(this.storageRuntime())return;
  for(const entry of await readdir(root,{withFileTypes:true})){
   if(!entry.isDirectory()||entry.isSymbolicLink()||!/^ref-[a-f0-9-]{36}$/.test(entry.name))continue;
   const folder=join(root,entry.name),owner=await readFile(join(folder,'owner.json'),'utf8').then(JSON.parse).catch(()=>null);
   if(!owner||!Number.isSafeInteger(owner.pid))continue;
   let alive=true;try{process.kill(owner.pid,0)}catch{alive=false}
   if(alive)continue;
   const complete=await readFile(join(folder,'reference.json'),'utf8').then(JSON.parse).catch(()=>null);
   const target=complete?.version===1&&complete.id===entry.name?join(folder,'download'):folder;
   // A crashed session's disposable directory only; no age-based eviction of
   // completed evidence or media retained for a week-long edit.
   const info=await lstat(target).catch(()=>null);if(info&&!info.isSymbolicLink()&&within(root,await realpath(target)))await rm(target,{recursive:true});
  }
 }
 private async folder(id:string){if(!/^ref-[a-f0-9-]{36}$/.test(id))throw Error('ID de referencia inválido.');const {folder}=await this.roots(),path=join(folder,id);if((await lstat(path)).isSymbolicLink()||!within(folder,await realpath(path)))throw Error('Referencia fuera del proyecto.');return path;}
 private base(){return ['--encoding','utf-8','--ignore-config','--no-plugin-dirs','--no-remote-components','--no-playlist','--no-cache-dir','--no-warnings','--socket-timeout','15','--retries','1','--fragment-retries','1',...(this.tools.node?['--js-runtimes',`node:${this.tools.node}`]:[])];}
 async call(raw:unknown):Promise<{output:unknown;images?:ToolImage[]}>{
  if(!raw||typeof raw!=='object')throw Error('Faltan los argumentos.');
  const a=raw as {action?:string;source?:string;focus?:string;id?:string;start?:number;end?:number;frames?:number;includeAudio?:boolean;keepSource?:boolean;initialInspection?:boolean};
  if(a.action==='analyze'){
   if(this.busy)throw Error('Ya se está analizando una referencia. Esperá a que termine.');this.busy=true;this.cancelled=false;
   try{return await this.analyze(a)}finally{this.busy=false}
  }
  if(!a.id)throw Error('Falta el ID de referencia.');const folder=await this.folder(a.id);
  const m=JSON.parse(await readFile(join(folder,'reference.json'),'utf8')) as ReferenceManifest;
  if(m.id!==a.id||m.version!==1)throw Error('Referencia inválida.');
  if(a.action==='read')return{output:m,images:await this.images(m,folder)};
  if(a.action==='release'){
   if(m.sourcePath){const target=await realpath(m.sourcePath);if(!within(folder,target)||await lstat(target).then(s=>s.isSymbolicLink()))throw Error('El archivo no pertenece a esta referencia.');await rm(target);delete m.sourcePath;m.temporarySourceRemoved=true;await writeFile(join(folder,'reference.json'),JSON.stringify(m,null,2));}
   return{output:{id:m.id,released:true,framesPreserved:true,audioPreserved:!!m.audioPath}};
  }
  // Intentionally no broad cache deletion: never delete user media/project imports.
  if(a.action==='dispose'){const runtime=this.storageRuntime();if(!runtime)throw Error('No está disponible la papelera de Syka. La referencia se conserva.');const trashId=await moveToStorageTrash(runtime,await realpath(this.cwd),folder,'reference','Referencia descartada');return{output:{id:a.id,removed:true,trashId,recoverable:true,note:'Podés recuperarla desde Configuración → Almacenamiento durante el plazo de la papelera.'}};}
  throw Error('Acción de referencia desconocida.');
 }
 private async images(m:ReferenceManifest,folder:string){const images:ToolImage[]=[];for(const frame of m.frames){const path=await realpath(frame.path);if(!within(folder,path))throw Error('Captura fuera de la referencia.');if((await stat(path)).size>512*1024)continue;images.push({mediaType:'image/jpeg',data:(await readFile(path)).toString('base64')});}return images;}
 private async analyze(a:{source?:string;focus?:string;start?:number;end?:number;frames?:number;includeAudio?:boolean;keepSource?:boolean;initialInspection?:boolean}){
  if(!a.source||!a.focus?.trim()||a.focus.length>1200)throw Error('Indicá el alcance de la inspección inicial o el aspecto pedido por el usuario.');
  const sourceInput=a.source;
  if(a.initialInspection!==undefined&&typeof a.initialInspection!=='boolean')throw Error('initialInspection debe ser booleano.');
  if(a.initialInspection)a={...a,frames:4,includeAudio:false,keepSource:false};
  if(a.frames!==undefined&&(!Number.isInteger(a.frames)||a.frames<2||a.frames>24))throw Error('Usá de 2 a 24 capturas.');
  const remote=publicVideoUrl(sourceInput);if(!remote&&!isAbsolute(sourceInput))throw Error('Usá un video local o un enlace público individual de Instagram, TikTok, X o YouTube.');
  const {folder}=await this.roots(),id='ref-'+randomUUID(),evidence=join(folder,id);await mkdir(evidence);
  const temp=join(evidence,'download');await mkdir(temp);await writeFile(join(evidence,'owner.json'),JSON.stringify({pid:process.pid,createdAt:new Date().toISOString()}),{flag:'wx'});let downloaded=false,source='',sourceStart=a.start??0;
  try {
   this.storageJobId=id.slice(4);await createStorageJob(this.storageRuntime(),{id:this.storageJobId,kind:'reference-download',base:await realpath(this.cwd),path:temp});
   if(remote){
    const info=parseVideoToolJson(await this.run(this.tools.ytDlp,[...this.base(),...YTDLP_METADATA_ARGS,'--',remote.url],90000,true),'metadata');
    if(['playlist','multi_video'].includes(info._type))throw Error('Este enlace tiene varios elementos. Pasá un enlace individual o el archivo que querés analizar.');
    if(info.is_live||['is_live','is_upcoming','post_live'].includes(info.live_status))throw Error('Elegí un video terminado o un archivo local; no descargamos directos en curso.');
    const duration=Number(info.duration);
    if(a.initialInspection)a.end=Math.min(a.end??sourceStart+20,sourceStart+20,Number.isFinite(duration)&&duration>0?duration:Infinity);
    if((!Number.isFinite(duration)||duration<=0||duration>600)&&a.end===undefined)throw Error('Elegí el tramo a analizar (inicio y final, hasta 10 minutos).');
    const end=a.end??duration;this.range(sourceStart,end,duration);
    const section=a.start!==undefined||a.end!==undefined,normalFormat='bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/best[ext=mp4][height<=1080]/best[height<=1080]';
    const format=remote.platform==='youtube'&&section?youtubeSectionFormat(normalFormat):normalFormat;
    await this.run(this.tools.ytDlp,[...this.base(),...YTDLP_FFMPEG_NETWORK_ARGS,'--max-filesize','500M','--format',format,'--merge-output-format','mp4',...(this.tools.ffmpeg?['--ffmpeg-location',this.tools.ffmpeg]:[]),...(section?['--download-sections',`*${sourceStart}-${end}`,'--force-keyframes-at-cuts']:[]),'--output',join(temp,'source.%(ext)s'),'--',remote.url],45*60_000);
    const candidates=(await readdir(temp)).filter(f=>/^source\.(mp4|webm|mkv|mov)$/.test(f));if(candidates.length!==1)throw Error('La descarga no produjo un video individual compatible.');source=join(temp,candidates[0]!);downloaded=true;
   }else{source=await realpath(sourceInput);if(!(await stat(source)).isFile())throw Error('El archivo local no existe.');}
   const probe=parseVideoToolJson(await this.run(this.tools.ffprobe,['-v','error','-show_format','-show_streams','-of','json',source],120000,true),'probe');
   if(!probe.streams?.some((s:any)=>s.codec_type==='video'))throw Error('El archivo no tiene una pista de video.');
   const total=Number(probe.format?.duration);if(!Number.isFinite(total)||total<=0)throw Error('No se pudo leer la duración real.');
   const offset=downloaded?0:sourceStart,end=downloaded?total:(a.initialInspection?Math.min(a.end??total,sourceStart+20,total):(a.end??total));this.range(offset,end,total);
   const duration=end-offset,count=a.frames??12,frames:ReferenceManifest['frames']=[];
   for(let i=0;i<count;i++){
    const time=duration<.1?0:(duration-.08)*i/(count-1),path=join(evidence,`frame-${String(i).padStart(2,'0')}.jpg`);
    await this.run(this.tools.ffmpeg,['-nostdin','-hide_banner','-loglevel','error','-n','-ss',String(offset+time),'-i',source,'-frames:v','1','-vf','scale=960:-2:force_original_aspect_ratio=decrease','-q:v','3',path],30000);
    if(!(await stat(path)).size)throw Error('No se pudo extraer una captura.');frames.push({path,time:Math.round((sourceStart+time)*1000)/1000});
   }
   const m:ReferenceManifest={version:1,id,source:remote?.url??source,focus:a.focus!.trim(),createdAt:new Date().toISOString(),duration,sourceStart,frames,temporarySourceRemoved:downloaded&&!a.keepSource,sampling:'Uniform samples at requested approximate seek times; not frame-exact or full motion coverage. View every frame; request a narrower interval for fast animation.'};
   if(a.includeAudio&&probe.streams?.some((s:any)=>s.codec_type==='audio')){
    m.audioPath=join(evidence,'audio-preview.mp3');await this.run(this.tools.ffmpeg,['-nostdin','-hide_banner','-loglevel','error','-n','-ss',String(offset),'-i',source,'-t',String(duration),'-map','0:a:0','-vn','-ar','48000','-c:a','libmp3lame','-b:a','192k',m.audioPath]);
   }
   if(a.keepSource){m.sourcePath=join(evidence,'source'+(source.match(/\.(mp4|webm|mkv|mov)$/i)?.[0]??'.mp4'));await copyFile(source,m.sourcePath);m.temporarySourceRemoved=false;}
   await writeFile(join(evidence,'reference.json'),JSON.stringify(m,null,2),{flag:'wx'});
   return{output:{...m,manifestPath:join(evidence,'reference.json'),note:'Capturas preparadas; leelas antes de describir el estilo. audioPath es una previsualización, no se agregó a la timeline. El original local sigue intacto.'},images:await this.images(m,evidence)};
  }catch(error){await rm(evidence,{recursive:true}).catch(()=>{});throw error}
  finally{await rm(temp,{recursive:true}).catch(()=>{});if(this.storageJobId){await settleStorageOwners(this.storageRuntime(),this.storageJobId);await finishStorageJob(this.storageRuntime(),this.storageJobId);this.storageJobId=undefined;}}
 }
 private range(start:number,end:number,total:number){if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||end-start>600||Number.isFinite(total)&&end>total+.1)throw Error('Elegí un tramo válido de hasta 10 minutos dentro del video.');}
}
