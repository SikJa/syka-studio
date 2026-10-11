import { afterEach, beforeEach, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { BackgroundRemovalService, type BackgroundJob } from '../src/host/background-removal';
import { WORKSPACE_TOOLS } from '../src/host/workspace-tools';
let root: string, service: BackgroundRemovalService;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'syka-background-test-'));
  const modules = join(root, 'node_modules'), runner = join(root, 'runner.mjs');
  await mkdir(join(modules, 'hyperframes/bin'), { recursive: true }); await mkdir(join(modules, 'onnxruntime-node'));
  await writeFile(join(modules, 'hyperframes/bin/hyperframes.mjs'), 'fixture, never used');
  await writeFile(join(root, 'persona.mp4'), 'fixture input, no segmentation');
  await writeFile(runner, `const config=JSON.parse(process.argv[3]); if(config.inputPath.includes('fail')){process.stderr.write('fixture engine failure');process.exit(1)}else setTimeout(()=>{console.log(JSON.stringify({kind:'frame',index:1,total:1}));console.log(JSON.stringify({kind:'result',subject:config.folder+'/sujeto.webm',provider:'SIMULATED'}));},200);`);
  service = new BackgroundRemovalService({ node: process.execPath, runner, modules });
});
afterEach(async () => { if (!resolve(root).startsWith(resolve(tmpdir()) + sep) || !root.includes('syka-background-test-')) throw Error('Unsafe cleanup'); await rm(root, { recursive: true, force: true }); });
async function completed(id: string) { let job: BackgroundJob; for (let tries = 0; tries < 50; tries++) { job = await service.call({ action: 'status', projectDir: root, id }); if (['done', 'error', 'canceled'].includes(job.state)) return job; await new Promise(resolve => setTimeout(resolve, 30)); } throw Error('fixture timeout'); }
it('rejects missing range, invalid range, format, URL, traversal and unknown actions', async () => {
  for (const request of [{ source: 'persona.mp4' }, { source: 'persona.mp4', end: 31 }, { source: 'persona.mp4', start: 2, end: 1 }, { source: 'https://example.com/video.mp4', end: 1 }, { source: '../escape.mp4', end: 1 }, { source: 'runner.mjs', end: 1 }, { action: 'bad' }]) await expect(service.call({ action: 'start', projectDir: root, ...request } as never)).rejects.toThrow();
});
it('returns promptly, serializes jobs, retains final status and leaves original intact', async () => {
  const before = await readFile(join(root, 'persona.mp4'), 'utf8');
  const started = await service.call({ action: 'start', projectDir: root, source: 'persona.mp4', end: 1, separate: true });
  expect(started.state).toBe('preparing');
  await expect(service.call({ action: 'start', projectDir: root, source: 'persona.mp4', end: 1 })).rejects.toThrow('proceso');
  const done = await completed(started.id); expect(done.state).toBe('done'); expect(done.provider).toBe('SIMULATED'); expect(done.subject).toContain('assets/Recortes/');
  await new Promise(resolve => setTimeout(resolve, 50));
  const reopened = new BackgroundRemovalService({ node: '', runner: '', modules: '' });
  expect((await reopened.call({ action: 'status', projectDir: root, id: done.id })).state).toBe('done');
  expect(await readFile(join(root, 'persona.mp4'), 'utf8')).toBe(before);
});
it('reports engine errors instead of a fake success', async () => {
  await writeFile(join(root, 'fail.mp4'), 'fixture');
  const started = await service.call({ action: 'start', projectDir: root, source: 'fail.mp4', end: 1 });
  const done = await completed(started.id); expect(done.state).toBe('error'); expect(done.error).toContain('fixture engine failure');
});
it('recovers interrupted jobs and rejects foreign job records', async () => {
  const id = randomUUID(), folder = join(root, '.syka/background-removal'); await mkdir(folder, { recursive: true });
  await writeFile(join(folder, id + '.json'), JSON.stringify({ id, projectDir: root, state: 'processing' }));
  expect((await service.call({ action: 'status', projectDir: root, id })).error).toContain('interrumpió');
  await writeFile(join(folder, id + '.json'), JSON.stringify({ id, projectDir: 'other', state: 'done' }));
  await expect(service.call({ action: 'status', projectDir: root, id })).rejects.toThrow('pertenece');
});
it('exports the same native operation to agent harnesses', () => { expect(WORKSPACE_TOOLS.some(tool => tool.name === 'syka_remove_background')).toBe(true); });
it('cancels a running job without changing original source or reporting done', async () => {
  const original = await readFile(join(root, 'persona.mp4'), 'utf8');
  const started = await service.call({ action: 'start', projectDir: root, source: 'persona.mp4', end: 1 });
  expect((await service.call({ action: 'cancel', projectDir: root, id: started.id })).state).toBe('canceled');
  await new Promise(resolve => setTimeout(resolve, 250));
  expect((await service.call({ action: 'status', projectDir: root, id: started.id })).state).toBe('canceled');
  expect(await readFile(join(root, 'persona.mp4'), 'utf8')).toBe(original);
});
