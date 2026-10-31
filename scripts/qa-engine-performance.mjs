// Isolated browser fixture using the workspace's existing Playwright runtime.
// No user projects, provider calls, browser downloads or packaging operations.
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argument = (name, fallback) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
if (process.argv.includes('--help')) {
  console.log('node scripts/qa-engine-performance.mjs --phase=before|after [--url=http://localhost:5188] [--seconds=12]');
  process.exit(0);
}
const phase = argument('phase');
const seconds = Number(argument('seconds', '12'));
if (!['before', 'after'].includes(phase) || !Number.isFinite(seconds) || seconds < 1 || seconds > 30) throw Error('Invalid phase or measurement duration.');
const url = new URL(argument('url', 'http://localhost:5188'));
if (!['localhost', '127.0.0.1'].includes(url.hostname)) throw Error('Use an existing loopback Vite server.');
const executablePath = [
  join(process.env.PROGRAMFILES || 'C:/Program Files', 'Google/Chrome/Application/chrome.exe'),
  join(process.env['PROGRAMFILES(X86)'] || 'C:/Program Files (x86)', 'Microsoft/Edge/Application/msedge.exe'),
].find(existsSync);
if (!executablePath) throw Error('No installed Chrome/Edge found. This check installs nothing.');
const browser = await chromium.launch({ headless: true, executablePath });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.route('**/syka-performance-fixture', route => route.fulfill({ contentType: 'text/html', body:
    '<html><body style="margin:0"><main style="width:960px;height:540px"><canvas></canvas></main></body></html>' }));
  await page.goto(new URL('/syka-performance-fixture', url).href);
  await page.waitForLoadState('networkidle');
  await page.evaluate(async runtimeUrl => {
    const { createEngine } = await import('/src/engine/create-engine.ts');
    const { Scene, Playback, Tickers } = await import(runtimeUrl);
    const engine = createEngine('qa-performance-empty', { silent: true });
    engine.mount(document.querySelector('canvas'));
    const scene = engine.world.spawn(Scene, Playback);
    window.sykaPerformanceQa = { engine, scene, Playback, Tickers };
    engine.start();
  }, '/@fs/' + join(root, 'packages/runtime/src/index.ts').replaceAll('\\', '/'));
  await page.waitForTimeout(2200);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
  const before = await metrics();
  const idle = await page.evaluate(async duration => {
    const engine = window.sykaPerformanceQa.engine;
    const frame = engine.frame(), start = performance.now();
    await new Promise(resolve => setTimeout(resolve, duration));
    return { frames: engine.frame() - frame, elapsedMs: performance.now() - start };
  }, seconds * 1000);
  const after = await metrics();
  const interactive = await page.evaluate(async () => {
    const { engine, scene, Playback, Tickers } = window.sykaPerformanceQa;
    const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
    const frame = engine.frame(), start = performance.now();
    document.querySelector('canvas').dispatchEvent(new PointerEvent('pointermove', { clientX: 180, clientY: 120 }));
    while (engine.frame() === frame) await pause(1);
    const pointerLatencyMs = performance.now() - start;
    scene.set(Playback, { playing: true });
    const playingAt = performance.now(), playingFrame = engine.frame(); await pause(2000);
    const playbackFps = (engine.frame() - playingFrame) * 1000 / (performance.now() - playingAt);
    scene.set(Playback, { playing: false });
    const ticker = () => {};
    engine.world.get(Tickers).add(ticker);
    await pause(1200);
    const tickerAt = performance.now(), tickerFrame = engine.frame(); await pause(2000);
    const tickerFps = (engine.frame() - tickerFrame) * 1000 / (performance.now() - tickerAt);
    engine.world.get(Tickers).delete(ticker);
    engine.dispose();
    const disposedFrame = engine.frame(); await pause(100);
    return { pointerLatencyMs, playbackFps, tickerFps, stopped: engine.frame() === disposedFrame };
  });
  if (!interactive.stopped) throw Error('A disposed engine kept ticking.');
  if (phase === 'after' && (interactive.playbackFps < 40 || interactive.tickerFps < 40)) throw Error('Active playback/animation was throttled in the isolated fixture.');
  const result = { phase, fixture: 'empty real engine; silent; one Scene; no user media', browser: browser.version(),
    idle, idleFps: idle.frames * 1000 / idle.elapsedMs, rendererTaskSeconds: after.TaskDuration - before.TaskDuration,
    javascriptHeapMiB: after.JSHeapUsedSize / 1048576, ...interactive };
  const output = join(root, 'output/playwright'); mkdirSync(output, { recursive: true });
  writeFileSync(join(output, `engine-performance-${phase}.json`), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally { await browser.close(); }
