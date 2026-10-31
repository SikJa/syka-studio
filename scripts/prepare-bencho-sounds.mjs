/** Build-time rendering of the 24 reviewed MIT Bencho recipes. No app runtime dependency. */
import { readFile,writeFile,mkdir,copyFile } from 'node:fs/promises';
import { join,resolve,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { transform } from 'esbuild';
import { chromium } from 'playwright-core';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const sha=b=>createHash('sha256').update(b).digest('hex');
const vendor=join(repo,'scripts/lib/bencho');
export async function prepareBenchoSounds(out,browserPath) {
  const pin=JSON.parse(await readFile(join(vendor,'PINNED.json'),'utf8'));
  if(pin.commit!=='30ab35a575eb83eed8f086a6893d4d6426f4fa91'||pin.freeOnly!==true)throw Error('Unreviewed Bencho source');
  for(const file of pin.files)if(sha(await readFile(join(vendor,file.path)))!==file.sha256)throw Error('Bencho source changed: '+file.path);
  const source=await readFile(join(vendor,'sounds.ts'),'utf8');
  const compiled=await transform(source,{loader:'ts',format:'iife',globalName:'BenchoFree',target:'es2020'});
  await mkdir(out,{recursive:true});
  const browser=await chromium.launch({headless:true,...(browserPath?{executablePath:browserPath}:{})});
  try {
    const page=await browser.newPage();
    await page.addScriptTag({content:compiled.code});
    const entries=await page.evaluate(async()=>{
      const entries=[];
      for(const [index,name] of BenchoFree.SOUND_NAMES.entries()) {
        const notes=BenchoFree.SOUNDS[name],frames=Math.ceil((Math.max(...notes.map(n=>(n.at??0)+n.ms))+60)*48);
        const context=new OfflineAudioContext(2,frames,48000),random=Math.random;
        const seed=3107+index;let state=seed;
        // Deterministic noise in this isolated build page; no altered recipes.
        Math.random=()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296;};
        try {BenchoFree.schedule(context,notes,0,2.4);}finally{Math.random=random;}
        const rendered=await context.startRendering(),left=rendered.getChannelData(0),right=rendered.getChannelData(1);
        const pcm=new Float32Array(frames*2);let peak=0;
        for(let i=0;i<frames;i++){pcm[i*2]=left[i];pcm[i*2+1]=right[i];peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));}
        if(!Number.isFinite(peak)||peak<=0||peak>=1)throw Error('Silent or clipped Bencho sound '+name);
        const bytes=new Uint8Array(pcm.buffer);let binary='';
        for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));
        entries.push({id:name,notes,seed,frames,peak,pcmBase64:btoa(binary)});
      }
      return entries;
    });
    if(entries.length!==24)throw Error('Incomplete public Bencho bank');
    for(const entry of entries){const bytes=Buffer.from(entry.pcmBase64,'base64');entry.pcm=entry.id+'.f32';entry.pcmSha256=sha(bytes);entry.recipeSha256=sha(Buffer.from(JSON.stringify(entry.notes)));delete entry.pcmBase64;await writeFile(join(out,entry.pcm),bytes);}
    for(const file of ['LICENSE','THIRD_PARTY.md'])await copyFile(join(vendor,file),join(out,file));
    const result={version:1,provider:'Bencho',repository:pin.repository,commit:pin.commit,freeOnly:true,sourceFiles:pin.files,
      render:{sampleRate:48000,channels:2,volume:2.4,noiseSeed:'3107 + source index',browser:browser.version(),modelsLoaded:false,adaptation:'Upstream schedule rendered offline; fixed noise seed; same gain as approved preview; 60 ms tail.'},entries};
    await writeFile(join(out,'rendered.json'),JSON.stringify(result,null,2)+'\n');
    return {sounds:entries.length,out,modelsLoaded:false};
  }finally{await browser.close();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await prepareBenchoSounds(resolve(process.argv[2]??join(repo,'.runtime/bencho-20261025')),process.env.SYKA_BUILD_CHROMIUM)));
