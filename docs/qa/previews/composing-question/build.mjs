import {build} from 'esbuild';
import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,'../../../..');
const out=resolve(root,'../Pruebas Syka/Composing-pregunta-4-previews-2026-10-08');
await mkdir(out,{recursive:true});
await cp(join(root,'apps/web/src/assets/fonts/Inter-VariableFont_opsz,wght.ttf'),join(out,'Inter.ttf'));
await build({entryPoints:[join(here,'preview.tsx')],bundle:true,platform:'browser',format:'esm',target:'chrome120',jsx:'automatic',jsxImportSource:'react',outfile:join(out,'preview.js'),loader:{'.ttf':'file'},external:['./Inter.ttf'],minify:true,define:{'process.env.NODE_ENV':'"production"'}});
// Preserve transitions-dev snippets, semantic tokens and reduced-motion guards.
let snippets='';
for(const file of ['03-notification-badge.md','06-modal.md']){
 const body=await readFile(join('C:/Users/Sikora/.codex/skills/transitions-dev',file),'utf8');
 snippets += '\n'+[...body.matchAll(/```css\r?\n([\s\S]*?)```/g)].map(m=>m[1]).join('\n');
}
await writeFile(join(out,'transitions.css'),snippets);
await writeFile(join(out,'index.html'),'<!doctype html><html lang="es" data-kb-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Syka · Cuatro preguntas en movimiento</title><link rel="stylesheet" href="transitions.css"><link rel="stylesheet" href="preview.css"></head><body><div id="root"></div><script type="module" src="preview.js"></script></body></html>');
await cp(join(root,'node_modules/thinking-orbs/LICENSE'),join(out,'LICENSE.thinking-orbs.txt'));
const fontData=(await readFile(join(out,'Inter.ttf'))).toString('base64');
const css=(await readFile(join(out,'preview.css'),'utf8')).replaceAll('url(./Inter.ttf)','url(data:font/ttf;base64,'+fontData+')').replaceAll('url("./Inter.ttf")','url(data:font/ttf;base64,'+fontData+')');
const js=(await readFile(join(out,'preview.js'),'utf8')).replaceAll('</script','<\\/script');
await writeFile(join(out,'preview-portable.html'),`<!doctype html><html lang="es" data-kb-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Syka · Cuatro preguntas en movimiento</title><style>${snippets}\n${css}</style></head><body><div id="root"></div><script type="module">${js}</script></body></html>`);
const frames=[1,2,3,4].map(i=>`<article><iframe title="${['Foco','Órbita','Acople','Lienzo'][i-1]}" src="index.html?mode=clip&v=${i}"></iframe></article>`).join('');
const common=`@font-face{font-family:Inter;src:url(Inter.ttf)}*{box-sizing:border-box}body{margin:0;background:#0d0e10;color:#e9edf2;font-family:Inter,system-ui}header{padding:30px 40px 15px;display:flex;align-items:baseline;justify-content:space-between}h1{font-size:24px;font-weight:530;letter-spacing:-.7px;margin:0}header span{color:#8d98a6;font-size:11px}main{display:grid;gap:10px;padding:0 12px}article{min-width:0;overflow:hidden}iframe{display:block;width:100%;height:880px;border:0}footer{text-align:center;color:#84909f;font-size:11px;padding:12px 30px 22px}`;
await writeFile(join(out,'gallery.html'),`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Syka · Cuatro previews</title><style>${common}main{grid-template-columns:repeat(2,minmax(0,1fr));max-width:1180px;margin:auto}@media(max-width:750px){main{grid-template-columns:1fr}header{padding:24px}header span{display:none}}</style></head><body><header><h1>Una pregunta. Cuatro maneras de llegar.</h1><span>SYKA · COMPOSING</span></header><main>${frames}</main><footer>Respondé en cada preview para ver cómo vuelve al chat.</footer></body></html>`);
await writeFile(join(out,'comparison.html'),`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Syka · Cuatro previews animadas</title><style>${common}main{grid-template-columns:repeat(4,minmax(0,1fr));gap:0;padding:0 12px}iframe{height:880px}header{padding:28px 32px 12px}footer{padding:6px}</style></head><body><header><h1>El orbe avisa. El chat hace lugar.</h1><span>01 FOCO · 02 ÓRBITA · 03 ACOPLE · 04 LIENZO</span></header><main>${frames}</main><footer>Previews de interacción · respuesta simulada para mostrar la continuación del chat</footer></body></html>`);
console.log(JSON.stringify({out,entry:'index.html',scope:'Interactive prototypes using the actual Syka composing orb; no production chat changes'}));
