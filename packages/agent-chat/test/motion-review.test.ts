import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, symlink, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { motionReview, motionReviewPreviews, reviewPlan } from '../src/host/motion-review';
import { resolveLocalTool } from '../src/host/local-tools';
import { WorkspaceTools, WORKSPACE_TOOLS } from '../src/host/workspace-tools';
const env = Object.fromEntries(Object.entries(process.env).filter((e): e is [string, string] => typeof e[1] === 'string'));
const ffmpeg = resolveLocalTool('ffmpeg', { env }).path;
const ffprobe = resolveLocalTool('ffprobe', { env }).path;
let root: string;
beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'syka-motion-review-')); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });
function command(binary: string, args: string[]) {
  return new Promise<void>((ok, fail) => {
    const child = spawn(binary, args, { windowsHide: true }); let errors = '';
    child.stderr.on('data', d => { errors += String(d); });
    child.on('error', fail); child.on('close', c => c === 0 ? ok() : fail(Error(errors)));
  });
}
describe('motion evidence planning', () => {
  it('maps composition events into a trimmed export without offsetting focus or reading',()=>{
    const frames=Array.from({length:24},(_,index)=>({index,seconds:index/24}));
    const plan=reviewPlan(frames,1,.5,[.5],[{id:'impact',seconds:5.5}],5);
    expect(plan.eventFrames[0]).toMatchObject({id:'impact',compositionSeconds:5.5,requestedSeconds:.5,frames:[{index:11},{index:12},{index:13}]});
    expect(plan.reading[0]!.requestedSeconds).toBe(.5);
    expect(plan.focusTime).toBe(.5);
    expect(()=>reviewPlan(frames,1,.5,[.5],[{id:'outside',seconds:4}],5)).toThrow();
    expect(()=>reviewPlan(frames,1,.5,[.5],[],NaN)).toThrow('Origen');
  });
  it('uses actual VFR timestamps and keeps consecutive indices at either boundary', () => {
    const frames = Array.from({ length: 24 }, (_, index) => ({ index, seconds: index < 12 ? index / 24 : .5 + (index - 12) / 12 }));
    const p = reviewPlan(frames, 1.5, 1.49, [.53]);
    expect(p.burst.map(f => f.index)).toEqual(Array.from({ length: 12 }, (_, i) => i + 12));
    expect(p.reading[0]!.seconds).toBe(.5);
    expect(reviewPlan(frames, 1.5, 0).burst[0]!.index).toBe(0);
    expect(p.contact.at(-1)!.index).toBe(23);
    expect(new Set(p.contact.map(f => f.index)).size).toBe(p.contact.length);
  });
  it('rejects out-of-range focus, nonmonotonic frames and invalid reading times', () => {
    const f = [{ index: 0, seconds: 0 }, { index: 1, seconds: .1 }];
    expect(() => reviewPlan(f, .2, .2)).toThrow();
    expect(() => reviewPlan(f, .2, 0, [NaN])).toThrow();
    expect(() => reviewPlan([f[0]!, f[0]!], .2, 0)).toThrow();
    expect(() => reviewPlan(f, 181, 0)).toThrow();
  });
  it('captures actual encoded neighboring frames around shared events including export boundaries', () => {
    const frames = Array.from({ length: 24 }, (_, index) => ({ index, seconds: index / 24 }));
    const plan = reviewPlan(frames, 1, .5, [.5], [{ id: 'first', seconds: 0 }, { id: 'impact', seconds: .5 }, { id: 'end', seconds: 1 }]);
    expect(plan.eventFrames.map(e => e.frames.map(f => f.index))).toEqual([[0, 1], [11, 12, 13], [22, 23]]);
    expect(() => reviewPlan(frames, 1, .5, undefined, [{ id: 'same', seconds: 0 }, { id: 'same', seconds: .5 }])).toThrow('duplicados');
  });
});
describe('native workspace export review', () => {
  it('rejects external paths before spawning a media process', async () => {
    await expect(motionReview(root, { source: '../other.mp4', focusTime: 0 })).rejects.toThrow('dentro');
    await expect(motionReview(root, { source: 'https://example.com/v.mp4', focusTime: 0 })).rejects.toThrow();
    expect(WORKSPACE_TOOLS.some(t => t.name === 'syka_motion_review')).toBe(true);
  });
  it.skipIf(!ffmpeg || !ffprobe)('decodes a real 24fps export through WorkspaceTools without changing it', async () => {
    const source = join(root, 'export.mp4');
    await command(ffmpeg!, ['-nostdin', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=24:duration=1', '-c:v', 'libx264', source]);
    await writeFile(join(root, 'index.tsx'), '<scene/>');
    const before = createHash('sha256').update(await readFile(source)).digest('hex');
    const tools = new WorkspaceTools(root, undefined, undefined, undefined, undefined, env);
    const result = await tools.call('syka_motion_review', { source, focusTime: .98, readingTimes: [.5], events: [{ id: 'impact', seconds: .5 }] }) as Awaited<ReturnType<typeof motionReview>>;
    expect(result.sha256).toBe(before);
    expect(createHash('sha256').update(await readFile(source)).digest('hex')).toBe(before);
    expect(result.video.decodedFrames).toBe(24);
    expect(result.automaticChecks).toMatchObject({ decodedFrames: 24, loopSeam: null });
    expect(result.images.find(i => i.kind === 'burst')!.frames.map(f => f.index)).toEqual(Array.from({ length: 12 }, (_, n) => n + 12));
    const phone = await readFile(result.images.find(i => i.kind === 'reading')!.path);
    expect(phone.readUInt32BE(16)).toBe(360);
    expect(phone.readUInt32BE(20)).toBe(231); // 203px picture + external 28px label, original aspect rounded.
    expect(JSON.parse(await readFile(result.manifestPath, 'utf8')).status).toBe('complete');
    expect(result.exportRevisionVerified).toBe(false);
    const previews = await motionReviewPreviews(result);
    expect(result.images.find(i => i.kind === 'event')).toMatchObject({ eventId: 'impact', frames: [{ index: 11 }, { index: 12 }, { index: 13 }] });
    expect(previews).toHaveLength(4);
    expect(previews.every(i => i.mediaType === 'image/png' && i.data.length <= 512 * 1024)).toBe(true);
    expect(Buffer.from(previews[2]!.data, 'base64').readUInt32BE(16)).toBe(360);
  }, 30_000);
  it.skipIf(!ffmpeg || !ffprobe)('refuses an output junction before creating files outside the project', async () => {
    const outside = join(root, 'outside'), project = join(root, 'project');
    await mkdir(outside); await mkdir(project);
    await symlink(outside, join(project, 'reviews'), process.platform === 'win32' ? 'junction' : 'dir');
    const source = join(project, 'export.mp4');
    await command(ffmpeg!, ['-nostdin', '-v', 'error', '-f', 'lavfi', '-i', 'color=size=320x180:duration=0.6', '-c:v', 'libx264', source]);
    await expect(motionReview(project, { source, focusTime: .2 }, { env })).rejects.toThrow('sale del proyecto');
  }, 30_000);
  it.skipIf(!ffmpeg || !ffprobe)('finds a real encoded one-frame flash and screens a declared loop', async () => {
    const source = join(root, 'flash.mp4');
    await command(ffmpeg!, ['-nostdin', '-v', 'error', '-f', 'lavfi', '-i', 'color=black:size=320x180:rate=30:duration=0.6', '-vf', "drawbox=color=white:t=fill:enable='eq(n,5)'", '-c:v', 'libx264', source]);
    const result = await motionReview(root, { source, focusTime: 5 / 30, loop: true, declaredCuts: [5 / 30] }, { env });
    expect(result.automaticChecks).toMatchObject({ flashCandidatesTotal: 1, flashCandidates: [{ frame: 5, nearDeclaredCut: true }], loopSeam: { needsInspection: false } });
  }, 30_000);
});
