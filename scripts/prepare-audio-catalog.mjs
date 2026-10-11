/** Assemble licensed local packs and original synthesis; no fetched code is executed. */
import { readdir, readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { synthEffect, synthMusic, saveAudio, pcmWave, EFFECTS, measure } from '../docs/skills/syka-local-audio/scripts/audio-studio.mjs';
const args={};for(let i=2;i<process.argv.length;i+=2)args[process.argv[i]]=process.argv[i+1];
if(!args['--source-dir'])throw Error('Use --source-dir <extracted Kenney packs> [--ffprobe path]');
const source=resolve(args['--source-dir']),target=resolve('docs/resources/sounds'),ffprobe=args['--ffprobe']||'ffprobe';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const providers=[
  {id:'interface',name:'Kenney Interface Sounds',url:'https://kenney.nl/assets/interface-sounds',zip:'interface.zip',sha256:'f2193d072726d6758a5f7871b2dcc54dcce0d5c35c6f0a62f92549b327c81232'},
  {id:'ui',name:'Kenney UI Audio',url:'https://kenney.nl/assets/ui-audio',zip:'ui.zip',sha256:'946fc23a63d535d693eb31b2eabb80c8c28d6351e2186b344ceb71b2cb1d5eb6'},
];
async function walk(folder){const list=[];for(const e of await readdir(folder,{withFileTypes:true})){if(e.isSymbolicLink())continue;const path=join(folder,e.name);if(e.isDirectory())list.push(...await walk(path));else if(e.isFile())list.push(path);}return list;}
function probe(path){const run=spawnSync(ffprobe,['-v','error','-show_entries','format=duration:stream=sample_rate,channels','-of','json',path],{encoding:'utf8',windowsHide:true});if(run.error||run.status!==0)throw Error('Cannot probe audio: '+path);const data=JSON.parse(run.stdout);const duration=Number(data.format.duration);if(!Number.isFinite(duration)||duration<=0)throw Error('Invalid audio duration');return {duration,sampleRate:Number(data.streams[0].sample_rate),channels:Number(data.streams[0].channels)};}
async function generated(path,result,stems=false){
  try {
    const expected=[[path,result.samples],...(stems?Object.entries(result.stems).map(([name,samples])=>[path.replace('.wav','-'+name+'.wav'),samples]):[])];
    for(const [file,samples]of expected)if(!(await readFile(file)).equals(pcmWave(samples,result.rate)))throw Error('Generated audio changed: '+file);
  } catch(error) {if(error.code==='ENOENT'){await saveAudio(path,result,{stems});return;}throw error;}
}
await mkdir(target,{recursive:true});const entries=[];
for(const pack of providers){
  if(hash(await readFile(join(source,pack.zip)))!==pack.sha256)throw Error('Archive hash changed: '+pack.id);
  const files=await walk(join(source,pack.id)),license=files.find(p=>p.endsWith('License.txt'));
  if(!license||!/(CC0|CC0\))/i.test(await readFile(license,'utf8')))throw Error('Missing CC0 license');
  await copyFile(license,join(target,'LICENSE-KENNEY-'+pack.id.toUpperCase()+'.txt'));
  for(const path of files.filter(p=>p.toLowerCase().endsWith('.ogg')&&!/preview\.ogg$/i.test(p))){
    const name=path.split(/[\\/]/).pop(),stem=name.replace(/\.ogg$/i,''),slug=stem.replace(/[_\d]/g,' ').trim();
    const tags=[slug,'interface','ui','interfaz','botón'];
    const translations={click:['click','clic','selección'],switch:['switch','interruptor','cambio'],confirmation:['success','confirmación','éxito'],error:['error','aviso'],back:['atrás','back'],open:['abrir','open'],close:['cerrar','close'],select:['selección','select'],pluck:['pluck','pop','burbuja'],drop:['drop','caída'],scratch:['scratch','raspado'],scroll:['scroll','desplazar']};
    for(const [key,aliases]of Object.entries(translations))if(slug.includes(key))tags.push(...aliases);
    const out=join(target,'kenney',pack.id,name);await mkdir(join(target,'kenney',pack.id),{recursive:true});await copyFile(path,out);
    const families={back:'open-close',bong:'pop',click:'click',close:'open-close',confirmation:'success',drop:'pop',error:'error',glass:'chime',glitch:'glitch',maximize:'open-close',minimize:'open-close',open:'open-close',pluck:'pop',question:'notification',scratch:'texture',scroll:'texture',select:'click',switch:'switch',tick:'tap',toggle:'switch',mouseclick:'click',mouserelease:'click',rollover:'click'};
    entries.push({path:relative(target,out).replaceAll('\\','/'),brand:pack.name,title:stem.replaceAll('_',' '),provider:'Kenney',audioType:'sfx',audioFamily:families[slug]??'other',tags:[...new Set(tags)],license:'CC0-1.0',url:pack.url,sha256:hash(await readFile(out)),...probe(out)});
  }
}
const aliases={pop:['pop','burbuja','aparición','rebote'],click:['click','clic','selección'],tap:['tap','toque','contacto'],whoosh:['whoosh','swoosh','barrido','transición','aire'],swipe:['swipe','deslizar','rápido'],impact:['impact','impacto','golpe','bass','bajo'],riser:['riser','subida','anticipación','crecimiento'],downer:['downer','bajada','cierre'],chime:['chime','campana','brillo'],success:['success','éxito','confirmación'],notification:['notification','notificación','aviso'],shimmer:['shimmer','destello','brillo','sparkle']};
const names={pop:'Pop',click:'Click',tap:'Toque',whoosh:'Whoosh',swipe:'Barrido corto',impact:'Impacto suave',riser:'Subida',downer:'Bajada',chime:'Campana',success:'Confirmación',notification:'Notificación',shimmer:'Destello'};
for(const kind of Object.keys(EFFECTS))for(let variant=0;variant<3;variant++){
  const name=kind+'-'+(variant+1)+'.wav',out=join(target,'syka','sfx',name),result=synthEffect({kind,variant,seed:173+variant*53});
  await generated(out,result);let peak=0,cuePoint=0;for(let i=0;i<result.samples[0].length;i++)if(Math.abs(result.samples[0][i])>peak){peak=Math.abs(result.samples[0][i]);cuePoint=i/result.rate;}
  entries.push({path:relative(target,out).replaceAll('\\','/'),brand:'Syka · '+names[kind],title:names[kind]+' '+(variant+1),provider:'Syka',audioType:'sfx',audioFamily:kind==='swipe'?'whoosh':kind,tags:aliases[kind],license:'MIT',sha256:hash(await readFile(out)),duration:result.duration,sampleRate:result.rate,channels:2,cuePoint,...measure(result.samples)});
}
for(const [mood,bpm,name,tags]of [['warm',96,'Base cálida',['warm','cálida','música','music','fondo','bed','electrónica']],['pulse',116,'Pulso moderno',['pulse','pulso','tech','lanzamiento','música','music','fondo','bed']],['ambient',80,'Ambient suave',['ambient','suave','calma','música','music','fondo','bed']]]){
  const out=join(target,'syka','music',mood+'-loop.wav'),result=synthMusic({mood,bpm,bars:8,seed:29,loop:true});await generated(out,result,true);
  for(const [part,samples]of [['mix',result.samples],...Object.entries(result.stems)]){
    const path=part==='mix'?out:out.replace('.wav','-'+part+'.wav');
    const translated={harmony:'Armonía',melody:'Melodía',bass:'Bajo',drums:'Percusión'};
    entries.push({path:relative(target,path).replaceAll('\\','/'),brand:'Syka · Música',title:name+(part==='mix'?'': ' · '+translated[part]),provider:'Syka',audioType:part==='mix'?'music':'stem',tags:[...tags,...(part==='mix'?[]:['stem','capa',part,translated[part]])],license:'MIT',sha256:hash(await readFile(path)),duration:result.duration,sampleRate:result.rate,channels:2,bpm,loop:true,...measure(samples)});
  }
}
// A base rebuild must not discard subsequently imported licensed packs.
try {
  const previous=JSON.parse(await readFile(join(target,'catalog.json'),'utf8')),rebuilt=new Set(entries.map(e=>e.path));
  const profiles=new Map(previous.entries.map(e=>[e.path,e]));
  for(const entry of entries) {
    const prior=profiles.get(entry.path);
    if(prior?.sha256===entry.sha256&&prior.soundProfile) {
      entry.soundProfile=prior.soundProfile;
      if(entry.cuePoint===undefined&&prior.cuePoint!==undefined)entry.cuePoint=prior.cuePoint;
    }
  }
  for(const entry of previous.entries.filter(e=>!rebuilt.has(e.path))) {
    if(hash(await readFile(join(target,entry.path)))!==entry.sha256)throw Error('Preserved asset changed: '+entry.path);
    entries.push(entry);
  }
  for(const provider of previous.providers)if(!providers.some(p=>p.id===provider.id))providers.push(provider);
} catch(error) {if(error.code!=='ENOENT')throw error;}
const catalog={version:1,providers,entries};await writeFile(join(target,'catalog.json'),JSON.stringify(catalog,null,2)+'\n');
console.log(JSON.stringify({total:entries.length,kenney:entries.filter(e=>e.provider==='Kenney').length,proceduralSfx:36,music:3,stems:entries.filter(e=>e.audioType==='stem').length,bytes:(await Promise.all(entries.map(async e=>(await readFile(join(target,e.path))).length))).reduce((a,b)=>a+b,0)}));
