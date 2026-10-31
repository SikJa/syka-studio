/** Publish only reviewed public MIT Bencho sounds. Preserves existing resources. */
import { readFile,writeFile,mkdir,rename,unlink } from 'node:fs/promises';
import { dirname,join,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash,randomUUID } from 'node:crypto';
import { wave24 } from './import-earshot-sounds.mjs';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const sha=b=>createHash('sha256').update(b).digest('hex');
const metadata={
  paid:['Pago confirmado','success',['pago','confirmación','resultado','payment']],
  landed:['Acción completada','success',['completar','resultado','llegada','success']],
  plop:['Pop suave','pop',['burbuja','acción','soft','bubble']],
  beacon:['Aviso de campana','notification',['aviso','campana','bell']],
  drift:['Movimiento suave','whoosh',['movimiento','deslizar','suave','movement']],
  hush:['Cierre suave','downer',['cierre','apagar','silenciar','close']],
  wisp:['Deslizamiento breve','whoosh',['movimiento','deslizar','corto','swipe']],
  sigh:['Respuesta descendente','downer',['respuesta','rechazo','descendente']],
  perk:['Llamada de atención','notification',['atención','aviso','attention']],
  purr:['Espera grave','texture',['espera','grave','system','idle']],
  lull:['Pulso tranquilo','texture',['calma','pulso','suave','movement']],
  whisk:['Barrido corto','whoosh',['barrido','navegación','swipe']],
  buzz:['Respuesta de error','error',['error','rechazo','feedback']],
  bump:['Contacto suave','tap',['contacto','golpe','toque','tap']],
  float:['Movimiento flotante','texture',['flotar','movimiento','suave']],
  glide:['Transición deslizante','whoosh',['deslizar','navegación','transition']],
  step:['Paso de navegación','tap',['paso','navegación','step']],
  wander:['Movimiento sostenido','texture',['movimiento','sostenido','movement']],
  tick:['Selección suave','click',['selección','clic','tick','selection']],
  latch:['Interruptor seco','switch',['interruptor','selección','toggle','latch']],
  hail:['Aviso breve','notification',['aviso','notificación','notification']],
  drape:['Despliegue suave','whoosh',['desplegar','movimiento','reveal']],
  boot:['Inicio de sistema','success',['inicio','arranque','system','start']],
  drone:['Tono de espera','texture',['espera','grave','system','loading']],
};
async function preserve(path,bytes){try{if(!(await readFile(path)).equals(bytes))throw Error('Refusing to replace '+path);}catch(error){if(error.code!=='ENOENT')throw error;await mkdir(dirname(path),{recursive:true});await writeFile(path,bytes,{flag:'wx'});}}
async function atomic(path,bytes){const temporary=path+'.'+randomUUID()+'.tmp';try{await writeFile(temporary,bytes,{flag:'wx'});await rename(temporary,path);}finally{await unlink(temporary).catch(()=>undefined);}}
export async function importBenchoSounds(staging,docs=join(repo,'docs')){
  const source=JSON.parse(await readFile(join(staging,'rendered.json'),'utf8'));
  const pin=JSON.parse(await readFile(join(repo,'scripts/lib/bencho/PINNED.json'),'utf8'));
  if(source.commit!==pin.commit||source.freeOnly!==true||source.render?.modelsLoaded!==false||source.render.sampleRate!==48000||source.render.volume!==2.4||source.entries?.length!==24||JSON.stringify(source.sourceFiles)!==JSON.stringify(pin.files))throw Error('Unreviewed Bencho render');
  const license=await readFile(join(staging,'LICENSE')),thirdParty=await readFile(join(staging,'THIRD_PARTY.md'));
  if(sha(license)!==pin.files.find(f=>f.path==='LICENSE').sha256||sha(thirdParty)!==pin.files.find(f=>f.path==='THIRD_PARTY.md').sha256)throw Error('Bencho notices changed');
  const root=join(resolve(docs),'resources/sounds'),catalogPath=join(root,'catalog.json'),lock=join(root,'.bencho-import.lock');
  await writeFile(lock,String(process.pid),{flag:'wx'});
  try {
    const before=await readFile(catalogPath),catalog=JSON.parse(before),seen=new Set(),files=[];let added=0,bytes=0;
    for(const item of source.entries){
      if(!metadata[item.id]||seen.has(item.id)||item.pcm!==item.id+'.f32'||sha(Buffer.from(JSON.stringify(item.notes)))!==item.recipeSha256)throw Error('Invalid Bencho sound');
      seen.add(item.id);const pcm=await readFile(join(staging,item.pcm));if(sha(pcm)!==item.pcmSha256)throw Error('Bencho PCM changed');
      const {wave,profile}=wave24(pcm,item.frames,license.toString()+'\n'+thirdParty.toString()+'\nBencho public MIT source '+source.commit);
      const [title,audioFamily,tags]=metadata[item.id],path='bencho/'+item.id+'.wav',hash=sha(wave),derived=['beacon','plop'].includes(item.id);
      const entry={path,provider:'Bencho',brand:'Bencho',title:title+' · '+item.id,tags:['bencho','interfaz','ui',item.id,...tags],audioType:'sfx',audioFamily,license:'MIT',url:source.repository,sourceCommit:source.commit,sourceCue:item.id,sha256:hash,duration:item.frames/48000,sampleRate:48000,channels:2,bitDepth:24,cuePoint:profile.peakOffsetSeconds,soundProfile:profile,usage:'Public MIT Bencho SFX; copy:true for a portable project; measured cuePoint. '+(derived?'Rebuilt from Cuelume; both MIT notices included.':'Procedural synthesis, not a field recording.')};
      const previous=catalog.entries.find(e=>e.path===path);if(previous&&(previous.sha256!==hash||previous.provider!=='Bencho'))throw Error('Existing Bencho catalog sound differs');
      await preserve(join(root,path),wave);bytes+=wave.length;
      if(!previous){catalog.entries.push(entry);added++;}
      files.push({path,sha256:hash,sourceCue:item.id,recipeSha256:item.recipeSha256,seed:item.seed,derivedFrom:derived?'Cuelume':null});
    }
    await preserve(join(root,'LICENSE-BENCHO.txt'),license);await preserve(join(root,'CREDITS-BENCHO.md'),thirdParty);
    const manifest={version:1,provider:'Bencho',repository:source.repository,commit:source.commit,license:'MIT',freeOnly:true,sourceFiles:source.sourceFiles,licenseSha256:sha(license),creditsSha256:sha(thirdParty),render:{...source.render,bitDepth:24},files};
    const manifestPath=join(root,'sources/bencho.json');await mkdir(dirname(manifestPath),{recursive:true});
    await preserve(manifestPath,Buffer.from(JSON.stringify(manifest,null,2)+'\n'));
    if(!catalog.providers.some(p=>p.id==='bencho'))catalog.providers.push({id:'bencho',name:'Bencho · 24 public sounds',url:source.repository,license:'MIT',commit:source.commit,sourceManifest:'sources/bencho.json'});
    if(!(await readFile(catalogPath)).equals(before))throw Error('Catalog changed during Bencho import; retry');
    await atomic(catalogPath,JSON.stringify(catalog,null,2)+'\n');return {added,bencho:24,total:catalog.entries.length,bytes,modelsLoaded:false};
  }finally{await unlink(lock);}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await importBenchoSounds(resolve(process.argv[2]),process.argv[3])));
