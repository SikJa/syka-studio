import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { retimeCaptions } from '../src/host/caption-timing';
import { WorkspaceTools, WORKSPACE_TOOLS } from '../src/host/workspace-tools';
import { SourceTools } from '../src/host/source-tools';
import { transform } from 'esbuild';

const transcript = { segments: [{ text: 'Hola, ¿cómo andás?', words: [
  { text: 'Hola,', start: 10, end: 10.5 }, { text: '¿cómo', start: 11, end: 11.5 }, { text: 'andás?', start: 13, end: 14 },
] }] };
let fixture: string, project: string, tools: WorkspaceTools;
beforeEach(async () => {
  fixture = await mkdtemp(join(tmpdir(), 'syka-caption-timing-')); project = join(fixture, 'project'); await mkdir(project);
  await writeFile(join(project, 'speech.json'), JSON.stringify(transcript));
  tools = new WorkspaceTools(project, resolve('docs'));
});
afterEach(async () => {
  await tools.close();
  if (!fixture.startsWith(join(tmpdir(), 'syka-caption-timing-'))) throw Error('Unexpected fixture');
  await rm(fixture, { recursive: true, force: true });
});

describe('native caption timing through shared agent tools', () => {
  it.each([.25, .5, 1, 1.5, 2, 3, 4])('maps source words at %sx without double-applying trim', rate => {
    const result = retimeCaptions(transcript, [{ sourceIn: 10, sourceOut: 15, timelineStart: 3, playbackRate: rate }]);
    expect(result.segments[0]!.words[0]).toEqual({ text: 'Hola,', start: 3, end: 3 + .5 / rate });
    expect(result.segments[0]!.words[2]!.end).toBe(3 + 4 / rate);
    expect(result.segments[0]!.text).toBe(transcript.segments[0]!.text);
    expect(result.clippedCount).toBe(0);
  });
  it('discovers the tool, reads native guidance, creates compatible JSON and applies/undoes editable captions', async () => {
    expect(WORKSPACE_TOOLS.find(tool => tool.name === 'syka_captions_retime')).toBeDefined();
    const source = new SourceTools(project, resolve('docs'));
    expect(await source.call('syka_read_reference', { path: 'reference/jsx/captions.md' })).toMatchObject({ content: expect.stringContaining('<captions src=') });
    const result = await tools.call('syka_captions_retime', { source: 'speech.json', spans: [
      { sourceIn: 10, sourceOut: 12, timelineStart: 0, playbackRate: 2 },
      { sourceIn: 13.5, sourceOut: 15, timelineStart: 1, playbackRate: .5 },
    ] }) as { path: string; relativePath: string; words: number; clippedWords: number; provenance: { sourceSha256: string } };
    expect(result).toMatchObject({ words: 3, clippedWords: 1, provenance: { sourceSha256: expect.stringMatching(/^[a-f0-9]{64}$/) } });
    // Execute the actual renderer parser without pulling its browser-only
    // ambient asset types into the Node host's TypeScript project.
    const parser = await transform(await readFile(resolve('packages/runtime/src/media/caption/transcript.ts'), 'utf8'), { loader: 'ts', format: 'esm' });
    const { parseTranscriptJson } = await import('data:text/javascript;base64,' + Buffer.from(parser.code).toString('base64'));
    const rendered = parseTranscriptJson(await readFile(result.path, 'utf8')) as typeof transcript.segments;
    expect(rendered.flatMap(segment => segment.words)).toEqual([
      { text: 'Hola,', start: 0, end: .25 }, { text: '¿cómo', start: .5, end: .75 }, { text: 'andás?', start: 1, end: 2 },
    ]);
    const original = 'export default () => <scene><video src="take.mp4" /></scene>;';
    await writeFile(join(project, 'index.tsx'), original);
    const read = await source.call('syka_read_source', { path: 'index.tsx' }) as { sha256: string };
    const next = original.replace('</scene>', `<captions src="${result.relativePath}" preset="bridgeclip-subtle" /></scene>`);
    const edit = await source.call('syka_edit_source', { path: 'index.tsx', expectedSha256: read.sha256, content: next }) as { historyId: string; sha256: string };
    expect(await readFile(join(project, 'index.tsx'), 'utf8')).toContain(`<captions src="${result.relativePath}"`);
    await source.call('syka_undo_source', { historyId: edit.historyId, expectedSha256: edit.sha256 });
    expect(await readFile(join(project, 'index.tsx'), 'utf8')).toBe(original);
    expect(JSON.parse(await readFile(join(project, 'speech.json'), 'utf8'))).toEqual(transcript);
  });
  it('supports reordered or repeated source spans but rejects overlapping output and invented word timing', () => {
    const result = retimeCaptions(transcript, [{ sourceIn: 13, sourceOut: 14, timelineStart: 0 }, { sourceIn: 10, sourceOut: 11, timelineStart: 1 }, { sourceIn: 13, sourceOut: 14, timelineStart: 2 }]);
    expect(result.segments.map(segment => segment.words[0]!.text)).toEqual(['andás?', 'Hola,', 'andás?']);
    expect(() => retimeCaptions(transcript, [{ sourceIn: 10, sourceOut: 14, timelineStart: 0 }, { sourceIn: 13, sourceOut: 14, timelineStart: 1 }])).toThrow('superponen');
    expect(() => retimeCaptions([{ text: 'sin tiempos', words: [] }], [{ sourceIn: 0, sourceOut: 10, timelineStart: 0 }])).toThrow('sin tiempos');
    expect(() => retimeCaptions(transcript, [{ sourceIn: 10, sourceOut: 14, timelineStart: 0, playbackRate: 0 }])).toThrow('inválido');
  });
  it('refuses empty output, paths outside the project and redirected output folders without writing files', async () => {
    const args = { source: 'speech.json', spans: [{ sourceIn: 10, sourceOut: 15, timelineStart: 0 }] };
    await expect(tools.call('syka_captions_retime', { ...args, spans: [{ sourceIn: 0, sourceOut: 1, timelineStart: 0 }] })).rejects.toThrow('No hay palabras');
    await expect(tools.call('syka_captions_retime', { ...args, source: '../speech.json' })).rejects.toThrow('dentro del proyecto');
    const outside = join(fixture, 'outside'); await mkdir(outside);
    await symlink(outside, join(project, '03 Assets reutilizables'), process.platform === 'win32' ? 'junction' : 'dir');
    await expect(tools.call('syka_captions_retime', args)).rejects.toThrow('sale del proyecto');
    expect(await readdir(outside)).toEqual([]);
  });
});
