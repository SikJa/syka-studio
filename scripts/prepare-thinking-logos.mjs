import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { selection, customSources, artworkOverrides } from './thinking-logo-selection.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const target = resolve(root, 'apps/web/src/mirel-chat/features/agents/thinking-logos');
const library = JSON.parse(await readFile(resolve(root, 'docs/resources/logos/catalog.json'), 'utf8'));
const score = e => (e.variant === 'symbol' ? 50 : 0) + (/icon/.test(e.path) ? 15 : 0)
  - (/wordmark|[-/]text|[-/]brand|_logo/.test(e.path) ? 100 : 0) + (e.theme === 'light' ? 5 : 0);
const records = [];
for (const item of selection) {
  const custom = customSources[item.id];
  const override=artworkOverrides[item.id]??{};
  const entry = custom ?? (override.path?library.entries.find(e=>e.path===override.path):library.entries.filter(e => e.brand === item.brand).sort((a,b) => score(b)-score(a))[0]);
  if (!entry) throw Error(`Missing source: ${item.name}`);
  const sourcePath = custom ? entry.path : `docs/resources/logos/${entry.path}`;
  const svg = await readFile(resolve(root, sourcePath), 'utf8');
  if (!/<svg[\s>]/i.test(svg)) throw Error(`Not SVG: ${sourcePath}`);
  records.push({ ...item, svg, crop: !!entry.crop, ...override, kind: custom?.kind ?? 'brand', sourcePath,
    source: custom?.source ?? `${entry.provider}: ${entry.upstreamPath ?? entry.path}`,
    sha256: createHash('sha256').update(svg).digest('hex') });
}
await mkdir(resolve(target, 'data'), { recursive: true });
const bundled = await build({ stdin: { contents: `export {bakeLogo, serializeLogo} from './apps/web/src/mirel-chat/features/agents/thinking-logos/vendor/bake/bake';export {traceContours,loopLength} from './apps/web/src/mirel-chat/features/agents/thinking-logos/vendor/bake/contour';`, resolveDir: root }, bundle: true, write: false, format: 'iife', globalName: 'SykaLogoBaker', platform: 'browser' });
const browser = await chromium.launch({ headless: true });
const evidence = [];
try {
  const page = await browser.newPage();
  await page.setContent('<html><body></body></html>');
  await page.addScriptTag({ content: bundled.outputFiles[0].text });
  for (const record of records) {
    const result = await page.evaluate(async ({ svg, crop, id,foreground,cropViewBox,staticMonochrome,flattenOpacity,removePaths }) => {
      const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
      if (doc.querySelector('parsererror')) throw Error(`Invalid SVG ${id}`);
      const element = doc.documentElement;
      // Bundled artwork only: remove executable/external SVG features even at build time.
      for (const el of element.querySelectorAll('script,foreignObject,image,animate,animateTransform,set')) el.remove();
      for (const el of [element, ...element.querySelectorAll('*')]) {
        for (const attr of [...el.attributes]) {
          if (/^on/i.test(attr.name) || (/href$/i.test(attr.name) && !attr.value.startsWith('#')) || /url\(\s*["']?(?:https?:|\/\/)/i.test(attr.value)) el.removeAttribute(attr.name);
        }
      }
      element.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      element.setAttribute('style', 'color:#111');
      if (crop) {
        // Agent Reach's published artwork includes a canvas background and wordmark.
        element.querySelector('rect')?.remove();
        element.querySelectorAll('text').forEach(el => el.remove());
      }
      if(removePaths){const paths=[...element.querySelectorAll('path')];for(const index of removePaths)paths[index]?.remove();}
      if(flattenOpacity)for(const node of element.querySelectorAll('[opacity],[stroke-opacity],[fill-opacity]')){
        node.removeAttribute('opacity');node.removeAttribute('stroke-opacity');node.removeAttribute('fill-opacity');
      }
      const view = cropViewBox??(element.getAttribute('viewBox') ?? `0 0 ${parseFloat(element.getAttribute('width')) || 256} ${parseFloat(element.getAttribute('height')) || 256}`).split(/[\s,]+/).map(Number);
      element.setAttribute('viewBox', view.join(' '));
      element.setAttribute('width', String(view[2])); element.setAttribute('height', String(view[3]));
      const clean = new XMLSerializer().serializeToString(element);
      const image = new Image();
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(clean)}`;
      await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 320;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const scale = Math.min(304 / view[2], 304 / view[3]);
      ctx.drawImage(image, (320-view[2]*scale)/2, (320-view[3]*scale)/2, view[2]*scale, view[3]*scale);
      const pixels = ctx.getImageData(0,0,320,320).data;
      let white=0, other=0, colored=0, count=0;
      for(let i=0;i<pixels.length;i+=4) if(pixels[i+3]>127) {
        count++;
        if(Math.min(pixels[i],pixels[i+1],pixels[i+2])>240) white++; else other++;
        if(Math.max(pixels[i],pixels[i+1],pixels[i+2])-Math.min(pixels[i],pixels[i+1],pixels[i+2])>30) colored++;
      }
      if (!count) throw Error(`Empty raster: ${id}`);
      // Preserve negative white details (YouTube's triangle, letters inside app tiles).
      const knockoutWhite = white > count*.008 && other > count*.08;
      const alpha = new Float32Array(320*320);
      for(let p=0;p<alpha.length;p++) {
        const i=p*4;
        const negative = knockoutWhite ? Math.min(pixels[i],pixels[i+1],pixels[i+2])/255 : 0;
        const brightness=.2126*pixels[i]+.7152*pixels[i+1]+.0722*pixels[i+2];
        alpha[p] = pixels[i+3]/255 * (foreground==='light'?(brightness>100?1:0):(negative>.94?0:1));
      }
      // A monochrome SVG reconstructed from the exact mask preserves holes in both themes.
      // CSS brightness filters on the source would paint white and black regions the same.
      const mask={w:320,h:320,a:alpha};
      const contours=SykaLogoBaker.traceContours(mask,.5).filter(loop=>SykaLogoBaker.loopLength(loop)>5);
      const shape=contours.map(loop=>loop.map(([x,y],i)=>`${i?'L':'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('')+'Z').join('');
      const markSvg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320"><path fill="#111" fill-rule="evenodd" d="${shape}"/></svg>`;
      const opts={shell:'dome',resolution:320,seed:17,style:'fill',margin:.08};
      const small=JSON.parse(SykaLogoBaker.serializeLogo(await SykaLogoBaker.bakeLogo({mask:{w:320,h:320,a:alpha}},{...opts,count:150})));
      const large=JSON.parse(SykaLogoBaker.serializeLogo(await SykaLogoBaker.bakeLogo({mask:{w:320,h:320,a:alpha}},{...opts,count:520})));
      if(small.n<20 || large.n<60) throw Error(`Insufficient points: ${id} (${small.n}/${large.n})`);
      return {svg:clean,markSvg,monochrome:colored/count<.02||!!staticMonochrome,small,large,knockoutWhite,foreground:foreground??'alpha'};
    }, record);
    await writeFile(resolve(target,'data',`${record.id}.json`), JSON.stringify(result)+'\n');
    evidence.push({ id: record.id, name: record.name, category: record.category, added: record.added, kind: record.kind,
      sourcePath: record.sourcePath, source: record.source, sha256: record.sha256, small: result.small.n, large: result.large.n, knockoutWhite: result.knockoutWhite,foreground:result.foreground,sourceOverride:artworkOverrides[record.id]??null });
  }
} finally { await browser.close(); }
const catalog = records.map(({id,name,tint,category,added,aliases,domains,kind})=>({id,name,tint,category,added,aliases,domains,kind}));
await writeFile(resolve(target,'catalog.json'), JSON.stringify(catalog,null,2)+'\n');
await writeFile(resolve(root,'docs/resources/thinking-logos/manifest.json'), JSON.stringify({ version:1,engine:{repository:'https://github.com/enesozturk/thinking-logos',commit:'c18bc9c6470766f9a615303d35b43f446f0342b9',license:'MIT'}, entries:evidence },null,2)+'\n');
console.log(`Prepared ${evidence.length} marks (${evidence.filter(x=>x.added).length} additions). All have two baked sizes and provenance.`);
