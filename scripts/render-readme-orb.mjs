/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// The same preset, projection, state, and speed as AgentIdentityOrb's hero.
// Export the native transparent canvas; never composite a page background.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const work = resolve(root, '.runtime/readme-assets');
const output = resolve(root, 'apps/desktop/syka-assets');
const fps = 15;
await mkdir(work, { recursive: true });
await mkdir(output, { recursive: true });
await build({ stdin: { contents: `
import { MODE_DRAWS, resolvePreset } from 'thinking-orbs/engine';
const preset=64, speed=.45, p=resolvePreset('composing',preset);
const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d');
canvas.width=canvas.height=512;
window.orbPeriod=20*Math.PI;window.orbDuration=window.orbPeriod/(p.speed*speed);
window.captureOrb=(time,dark)=>{
ctx.setTransform(8,0,0,8,0,0);ctx.clearRect(0,0,preset,preset);
MODE_DRAWS[p.mode](ctx,preset,time,dark,p.opts);
return canvas.toDataURL('image/png').split(',')[1];
};
window.orbAlpha=(time,dark)=>{window.captureOrb(time,dark);const a=ctx.getImageData(0,0,512,512).data;
return {cornerAlpha:a[3],centerAlpha:a[(256*512+256)*4+3],transparentPixels:Array.from(a).filter((_,i)=>i%4===3&&a[i]===0).length};};
`, resolveDir: root }, bundle: true, format: 'esm', platform: 'browser', outfile: resolve(work, 'orb.js'), logLevel: 'error' });
const html = '<!doctype html><html><body style="margin:0"><canvas></canvas><script type="module" src="/orb.js"></script></body></html>';
const bundle = await readFile(resolve(work, 'orb.js'));
const server = createServer((req, res) => { res.setHeader('Content-Type', req.url === '/orb.js' ? 'text/javascript' : 'text/html'); res.end(req.url === '/orb.js' ? bundle : html); });
server.listen(0, '127.0.0.1'); await once(server, 'listening');
function encode(theme) {
  const child = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-probesize', '32', '-analyzeduration', '0', '-threads', '1', '-f', 'image2pipe', '-framerate', String(fps), '-vcodec', 'png', '-i', 'pipe:0', '-filter_threads', '1', '-vf', 'scale=128:128:flags=lanczos', '-c:v', 'libwebp', '-lossless', '1', '-compression_level', '3', '-threads', '1', '-loop', '0', resolve(output, `readme-orb-${theme}.webp`)], { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] });
  let stderr = ''; child.stderr.on('data', data => { stderr += data; });
  const done = new Promise((yes, no) => { child.once('error', no); child.once('close', code => code ? no(Error(stderr || 'Orb encoding failed.')) : yes()); });
  done.catch(() => {}); child.stdin.on('error', () => {});
  return { child, done };
}
let browser; const encoders = [];
try {
  browser = await chromium.launch({ headless: true, ...(process.env.SYKA_ASSET_BROWSER ? { executablePath: process.env.SYKA_ASSET_BROWSER } : {}) });
  const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(() => typeof window.captureOrb === 'function');
  const duration = await page.evaluate(() => window.orbDuration), count = Math.round(duration * fps);
  const dark = encode('dark'), light = encode('light'); encoders.push(dark, light);
  const alpha = await page.evaluate(() => ({ dark: window.orbAlpha(.6,true), light: window.orbAlpha(.6,false) }));
  if (alpha.dark.cornerAlpha || alpha.light.cornerAlpha || alpha.dark.transparentPixels < 10000) throw Error('Native orb transparency failed.');
  for (let i = 0; i < count; i++) {
    const images = await page.evaluate(({ i, count }) => { const t=.6+i*window.orbPeriod/count;return [window.captureOrb(t,true),window.captureOrb(t,false)]; }, { i, count });
    for (let j = 0; j < encoders.length; j++) {
      const encoder = encoders[j];
      if (encoder.child.exitCode !== null) await encoder.done;
      if (!encoder.child.stdin.write(Buffer.from(images[j], 'base64'))) await Promise.race([once(encoder.child.stdin, 'drain'), encoder.done.then(() => { throw Error('Orb encoder closed early.'); })]);
    }
    if (i % 250 === 0) console.log(`Native transparent orb: ${i}/${count}`);
  }
  for (const encoder of encoders) encoder.child.stdin.end();
  await Promise.all(encoders.map(encoder => encoder.done));
  const report = { preset: 64, state: 'composing', speed: .45, fps, frames: count, duration: count / fps, alpha, renderer: 'Native thinking-orbs/engine MODE_DRAWS; no background composite' };
  await writeFile(resolve(work, 'render-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} finally {
  for (const encoder of encoders) if (encoder.child.exitCode === null) encoder.child.kill();
  await browser?.close(); server.close();
}
