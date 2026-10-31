import {chromium} from 'playwright-core';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve,join} from 'node:path';
const out=resolve('output/playwright/thinking-logos');
const motion=join(out,'live-motion');
await mkdir(motion,{recursive:true});
const dir=resolve('../.runtime/diffusion/projects/Logos-real-20261013');
await mkdir(dir,{recursive:true});
const catalog=JSON.parse(await readFile('apps/web/src/mirel-chat/features/agents/thinking-logos/catalog.json','utf8'));
await writeFile(join(dir,'logos-inventory.json'),JSON.stringify(catalog,null,2));
await writeFile(join(dir,'AGENTS.md'),'Prueba local autorizada de logos. Usar exclusivamente Codex gpt-6.1-sol con esfuerzo medium. Sin subagentes. No modificar otros proyectos ni credenciales. No publicar ni llamar APIs externas.');
execFileSync('git',['init','--quiet',dir]);
const browser=await chromium.connectOverCDP('http://127.0.0.1:5235');
const page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().startsWith('http://localhost:5188')&&!p.url().includes('notifications.html'));
const project=await page.evaluate(async dir=>{const m=await import('/src/projects/host.ts');const p=await m.openProjectFolder(dir);return {id:p.id,name:p.name,dir:p.dir}},dir);
await page.goto(`http://localhost:5188/#/projects/${encodeURIComponent(project.id)}`);
await page.waitForFunction(async()=>{const m=await import('/src/agent-chat/store.ts');return m.chatState.connection==='open'});
const text='Validá el inventario de logos de este proyecto. Usá exactamente tres llamadas nativas de terminal, separadas, en este orden: 1) git status --short; Start-Sleep -Seconds 12. 2) node -e "const a=require(\'./logos-inventory.json\'); console.log(\'LOGOS\',a.length); if(a.length!==110)process.exit(1)"; Start-Sleep -Seconds 12. 3) python -m json.tool logos-inventory.json > $null; Start-Sleep -Seconds 12. En cada exec_command usá yield_time_ms: 20000 para esperar a que termine el comando; no lo dejes corriendo en segundo plano. Las pausas permiten observar en la UI las animaciones mientras la herramienta realmente está en ejecución. No uses subagentes, otras herramientas ni otro proveedor. No edites archivos. Terminá con un resumen breve en español de los resultados reales.';
const chatId=await page.evaluate(async options=>{const m=await import('/src/agent-chat/store.ts');m.setStoredModel(options.model);m.setSidebarTab('chat');return m.send(options)}, {projectId:project.id,cwd:dir,chatId:null,text,attachments:[],model:{harness:'codex',model:'gpt-6.1-sol',effort:'medium'}});
console.log(JSON.stringify({project,chatId,model:'gpt-6.1-sol',effort:'medium'}));
const frames=[],seen=new Set(),samples=[];
const deadline=Date.now()+240000;
let latest;
while(Date.now()<deadline){
  latest=await page.evaluate(async id=>{const m=await import('/src/agent-chat/store.ts');const c=m.chatState.chats[id];return {chat:c?.chat??c?.summary,items:c?.items??[],marks:[...document.querySelectorAll('.syka-thinking-logo')].map(e=>({brand:e.dataset.brand,moving:e.dataset.moving,label:e.getAttribute('aria-label')}))}},chatId);
  for(const mark of latest.marks.filter(m=>m.moving==='true')){
    const key=mark.brand+'-'+mark.label;
    if(!seen.has(key)){seen.add(key);const file=`real-${mark.brand}-${frames.length}.png`;await page.screenshot({path:join(out,file)});frames.push({...mark,file});console.log('LIVE',JSON.stringify(mark));}
    const element=page.locator(`[data-turn-activity] .syka-thinking-logo[data-brand="${mark.brand}"]`);
    if(await element.count()){
      const sample=await element.evaluate(e=>({brand:e.dataset.brand,size:e.getBoundingClientRect().width,overlay:e.querySelectorAll('.syka-logo-anchor').length,canvas:e.querySelector('canvas')?.toDataURL(),frame:e.querySelector('canvas')?.dataset.frame}));
      if(sample.size<=0)continue; // The real command may finish between reads.
      const file=`frame-${String(samples.length).padStart(4,'0')}.png`;
      const box=await page.locator('[data-turn-activity]').boundingBox();
      if(box)await page.screenshot({path:join(motion,file),clip:{x:box.x,y:box.y,width:box.width,height:Math.min(box.height,Math.max(1,720-box.y))}});
      samples.push({...sample,file});
    }
  }
  await writeFile(join(out,'real-turn-verification.json'),JSON.stringify({project,chatId,model:{harness:'codex',model:'gpt-6.1-sol',effort:'medium'},frames,motion:samples.map(({canvas,...sample})=>sample),pixelChanges:frames.map(f=>({brand:f.brand,distinctFrames:new Set(samples.filter(s=>s.brand===f.brand).map(s=>s.canvas)).size})),latest},null,2));
  if(latest.chat?.status!=='running'&&latest.chat?.status!=='waiting'&&latest.items.some(i=>i.kind==='assistant')&&frames.length>=3)break;
  await new Promise(r=>setTimeout(r,400));
}
await page.screenshot({path:join(out,'real-turn-final.png')});
const pixelChanges=frames.map(f=>({brand:f.brand,distinctFrames:new Set(samples.filter(s=>s.brand===f.brand).map(s=>s.canvas)).size}));
console.log('RESULT',JSON.stringify({frames,pixelChanges,items:latest.items,chat:latest.chat}));
process.exit(frames.length>=3&&pixelChanges.every(p=>p.distinctFrames>5)&&samples.every(s=>s.size===48&&s.overlay===0)?0:1);

