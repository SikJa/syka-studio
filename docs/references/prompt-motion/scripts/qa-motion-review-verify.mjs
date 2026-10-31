// Independent review of the real QA app: live backward seeks and an encoded last frame.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve, join, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const run = promisify(execFile);
const resources = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const expected = resolve(resources, '../../../../Pruebas Syka/QA-motion-review-2026-10-07');
const delay = ms => new Promise(ok => setTimeout(ok, ms));
let integration;
for (let attempt = 0; attempt < 1800; attempt++) {
  integration = JSON.parse(await readFile(join(resources, 'evidence/motion-review-integration.json'), 'utf8'));
  if (integration.error) throw Error(integration.error);
  if (integration.completedAt) break;
  await delay(500);
}
assert.ok(integration.completedAt, 'Native QA turn did not finish');
assert.equal(resolve(integration.project).toLowerCase(), expected.toLowerCase(), 'Only our named QA project is allowed');
const project = integration.project;
const evidence = join(project, 'qa-evidence/independent');
await mkdir(evidence, { recursive: true });
const result = { checkedAt: new Date().toISOString(), project, model: integration.model,
  kind: 'Real local Electron UI and native MCP; original-reference videos are not imported', liveSeek: [] };
const mcp = new Client({ name: 'syka-motion-independent-review', version: '1.0' });
let browser;
async function tool(name, args) {
  const reply = await mcp.callTool({ name, arguments: args }, undefined, { timeout: 180_000 });
  if (reply.isError) throw Error(reply.content?.filter(x => x.type === 'text').map(x => x.text).join('\n'));
  if (reply.structuredContent) return reply.structuredContent;
  return JSON.parse(reply.content.filter(x => x.type === 'text').map(x => x.text).join('\n'));
}
try {
  await mcp.connect(new StreamableHTTPClientTransport(new URL('http://127.0.0.1:3317/mcp')));
  const context = await tool('context', {});
  assert.equal(resolve(context.projectDir).toLowerCase(), expected.toLowerCase());
  browser = await chromium.connectOverCDP('http://127.0.0.1:9417');
  const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().startsWith('http://127.0.0.1:5317'));
  assert.ok(page, 'Only the isolated app page is inspected');
  const recon = await page.evaluate(() => ({ buttons: [...document.querySelectorAll('button')].map(x => x.getAttribute('aria-label')),
    canvases: [...document.querySelectorAll('canvas')].map((x, index) => ({ index, width: x.width, height: x.height, rect: x.getBoundingClientRect().toJSON() })) }));
  result.recon = recon;
  assert.ok(recon.buttons.includes('Ir al inicio · Inicio'));
  const mainCanvas = recon.canvases.filter(x => x.rect.width > 200 && x.rect.height > 200).sort((a, b) => b.rect.width * b.rect.height - a.rect.width * a.rect.height)[0];
  assert.ok(mainCanvas, 'Native scene canvas visible');
  await page.bringToFront();
  await page.getByRole('button', { name: 'Ir al inicio · Inicio', exact: true }).click();
  let current = 0;
  for (const [index, target] of [108, 36, 170, 77, 108].entries()) {
    const difference = target - current;
    for (let i = 0; i < Math.floor(Math.abs(difference) / 30); i++) { await page.keyboard.press(difference > 0 ? 'w' : 's'); await delay(45); }
    for (let i = 0; i < Math.abs(difference) % 30; i++) { await page.keyboard.press(difference > 0 ? 'd' : 'a'); await delay(45); }
    await delay(120); // Native render after the real keyboard seek, not a new capture mount.
    const state = await tool('context', {});
    assert.ok(Math.abs(state.currentTime - target / 30) < .001, `UI seek ${index}: expected ${target / 30}, got ${state.currentTime}`);
    const path = join(evidence, `live-${index}-${target}f.png`);
    await page.locator('canvas').nth(mainCanvas.index).screenshot({ path });
    result.liveSeek.push({ previousFrame: current, frame: target, actualSeconds: state.currentTime, screenshot: path });
    current = target;
    if (index === 0) await page.screenshot({ path: join(evidence, 'native-editor-3.6.png') });
  }
  const python = 'C:/Users/Sikora/AppData/Local/hermes/hermes-agent/venv/Scripts/python.exe';
  const comparison = await run(python, ['-c', 'import json,sys,hashlib; from PIL import Image,ImageChops; a=Image.open(sys.argv[1]).convert("RGB"); b=Image.open(sys.argv[2]).convert("RGB"); print(json.dumps({"equalPixels":ImageChops.difference(a,b).getbbox() is None,"firstPixelHash":hashlib.sha256(a.tobytes()).hexdigest(),"repeatPixelHash":hashlib.sha256(b.tobytes()).hexdigest(),"size":a.size}))', result.liveSeek[0].screenshot, result.liveSeek[4].screenshot]);
  result.seekRepeat = JSON.parse(comparison.stdout);
  assert.equal(result.seekRepeat.equalPixels, true, 'Repeated hold after backward seeks must match');
  const movie = resolve(integration.checks.nativeExport.path);
  const movieRelative = relative(project, movie);
  assert.ok(!movieRelative.startsWith('..') && !isAbsolute(movieRelative), 'Export must stay in our QA project');
  const probed = await run('C:/ffmpeg/bin/ffprobe.exe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', movie]);
  result.export = JSON.parse(probed.stdout);
  const video = result.export.streams.find(x => x.codec_type === 'video');
  assert.equal(video.width, 1920); assert.equal(video.height, 1080); assert.equal(video.avg_frame_rate, '60/1');
  assert.equal(Number(video.nb_frames), 600); assert.equal(Number(video.duration), 10);
  assert.equal(result.export.streams.filter(x => x.codec_type === 'audio').length, 0);
  await run('C:/ffmpeg/bin/ffmpeg.exe', ['-hide_banner', '-loglevel', 'error', '-y', '-i', movie,
    '-vf', 'select=eq(n\\,599)', '-frames:v', '1', join(evidence, 'export-last-599.png')]);
  result.lastEncodedFrame = { index: 599, seconds: 599 / 60, path: join(evidence, 'export-last-599.png'), inspected: false };
  const source = await readFile(join(project, 'index.tsx'), 'utf8');
  result.editableSource = { file: join(project, 'index.tsx'), nativeTextNodes: (source.match(/<text\b/g) || []).length,
    nativeRectNodes: (source.match(/<rect\b/g) || []).length, nativeGroups: (source.match(/<group\b/g) || []).length,
    nativeKeyframes: (source.match(/<keyframe\b/g) || []).length,
    htmlNodes: (source.match(/<html\b/g) || []).length, videoNodes: (source.match(/<video\b/g) || []).length };
  assert.equal(result.editableSource.htmlNodes, 0); assert.equal(result.editableSource.videoNodes, 0);
  result.reopened = await tool('open', { dir: project });
  result.reopenCheck = await tool('check', { id: 'qa_review' });
  assert.equal(result.reopened.id, integration.open.id);
  result.reopenedCapture = await tool('capture', { id: 'qa_review', times: ['3.6'], output: join(evidence, 'reopened') });
  await writeFile(join(resources, 'evidence/motion-review-verification.json'), JSON.stringify(result, null, 2) + '\n');
  process.stdout.write(JSON.stringify({ liveSeek: result.liveSeek.map(x => x.actualSeconds), repeatPixelsEqual: result.seekRepeat.equalPixels,
    export: { width: video.width, height: video.height, fps: video.avg_frame_rate, frames: video.nb_frames, duration: video.duration },
    editable: result.editableSource, lastFrame: result.lastEncodedFrame.path }) + '\n');
} catch (error) {
  result.error = error.stack; await writeFile(join(resources, 'evidence/motion-review-verification.json'), JSON.stringify(result, null, 2) + '\n'); throw error;
} finally { await mcp.close().catch(() => {}); await browser?.close().catch(() => {}); }
