import {build} from 'esbuild';
import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../../../..');
const lab='F:/Coding Proyects/Recursos frontend para sistemas/labs/component-lab';
const out=resolve(root,'../Pruebas Syka/Composing-Lienzo-v2-2026-10-08/mockup');
await mkdir(out,{recursive:true});
await cp(join(root,'apps/web/src/assets/fonts/Inter-VariableFont_opsz,wght.ttf'),join(out,'Inter.ttf'));
await build({entryPoints:[join(here,'preview.tsx')],bundle:true,platform:'browser',format:'esm',target:'chrome120',jsx:'automatic',jsxImportSource:'react',outfile:join(out,'mockup.js'),external:['./Inter.ttf'],minify:true,define:{'process.env.NODE_ENV':'"production"'},alias:{react:join(root,'node_modules/react'),'react-dom':join(root,'node_modules/react-dom'),'@desktop':join(root,'apps/desktop/src')},plugins:[{name:'workspace-source-alias',setup(plugin){plugin.onResolve({filter:/^@\//},args=>{
  const base=join(args.importer.replaceAll('\\','/').startsWith(lab)?join(lab,'src'):join(root,'apps/web/src'),args.path.slice(2));
  const path=[base,base+'.tsx',base+'.ts',base+'.js',join(base,'index.tsx'),join(base,'index.ts')].find(existsSync);
  return path?{path}:undefined;
});}}]});
let snippets='';
for(const file of ['03-notification-badge.md','06-modal.md','18-texts-reveal.md']){const reference=await readFile(join('C:/Users/Sikora/.codex/skills/transitions-dev',file),'utf8');snippets+='\n'+[...reference.matchAll(/```css\r?\n([\s\S]*?)```/g)].map(match=>match[1]).join('\n');}
await writeFile(join(out,'transitions.css'),snippets);
const shell=(styles,script)=>`<!doctype html><html lang="es" data-theme="dark" data-kb-theme="dark" data-motion="reduced"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Syka · Pregunta dentro del chat</title>${styles}</head><body><div id="root"></div>${script}</body></html>`;
await writeFile(join(out,'index.html'),shell('<link rel="stylesheet" href="transitions.css"><link rel="stylesheet" href="mockup.css">','<script type="module" src="mockup.js"></script>'));
const data=(await readFile(join(out,'Inter.ttf'))).toString('base64');
const css=(await readFile(join(out,'mockup.css'),'utf8')).replaceAll('url(./Inter.ttf)','url(data:font/ttf;base64,'+data+')');
const js=(await readFile(join(out,'mockup.js'),'utf8')).replaceAll('</script','<\\/script');
await writeFile(join(out,'Syka-pregunta-mockup.html'),shell(`<style>${snippets}\n${css}</style>`,`<script type="module">${js}</script>`));
console.log(JSON.stringify({out,labComponent:'Board UI Button source imported directly',composer:'Native AgentComposer',background:'#121212',scope:'Visual prototype; no production integration'}));
