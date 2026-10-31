import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname,resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const require=createRequire(import.meta.url),{chromium}=require('playwright-core');
const resources=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const record=JSON.parse(await readFile(join(resources,'evidence/typography-integration.json'),'utf8'));
const evidence=join(record.project,'qa-evidence/live-playback');await mkdir(evidence,{recursive:true});
const client=new Client({name:'typography-live-review',version:'1'});await client.connect(new StreamableHTTPClientTransport(new URL('http://127.0.0.1:3317/mcp')));
const browser=await chromium.connectOverCDP('http://127.0.0.1:9417');
const page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().startsWith('http://127.0.0.1:5317'));
const sleep=ms=>new Promise(ok=>setTimeout(ok,ms));
const result={project:record.project,playback:[],reviewScope:'Native preview played once at 1x. Screenshots sampled each second; no audio in brief.'};
async function context(){const r=await client.callTool({name:'context',arguments:{}});return r.structuredContent||JSON.parse(r.content.filter(x=>x.type==='text').map(x=>x.text).join(''));}
try{
 assert.equal(resolve((await context()).projectDir).toLowerCase(),resolve(record.project).toLowerCase());
 await page.bringToFront();
 for(const button of await page.getByRole('button',{name:'Ahora no',exact:true}).all()){if(await button.isVisible())await button.click();}
 await page.getByRole('button',{name:'Ir al inicio Â· Inicio',exact:true}).click();
 await page.getByRole('button',{name:'Reproducir Â· Espacio',exact:true}).click();
 for(let i=0;i<11;i++){await sleep(1000);const state=await context();result.playback.push({sample:i,seconds:state.currentTime,visibleComposition:state.visibleComposition});await page.locator('canvas').nth(1).screenshot({path:join(evidence,`play-${String(i).padStart(2,'0')}.png`)});}
 const pause=page.getByRole('button',{name:'Pausar Â· Espacio',exact:true});if(await pause.count())await pause.click();
 assert.ok(result.playback.some(x=>x.seconds>8),'Playback must reach the closing beat');
 await page.getByText('Biblioteca',{exact:true}).click();
 await page.getByText('AnimaciÃ³n',{exact:true}).click();
 const present=await page.getByText('Subida suave',{exact:true}).count();assert.ok(present,'New preset must be displayed in the actual library');
 await page.getByText('Subida suave',{exact:true}).scrollIntoViewIfNeeded();
 result.library={label:'Subida suave',visible:await page.getByText('Subida suave',{exact:true}).isVisible()};
 await page.screenshot({path:join(evidence,'native-preset-library.png')});
 await writeFile(join(evidence,'review.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{await client.close();await browser.close();}
