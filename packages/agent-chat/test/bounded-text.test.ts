import { mkdir, mkdtemp, readFile, rename, rm, symlink, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { boundedTextRead, indexText, readTextSnapshot, type TextReadOptions, type TextReadResult } from '../src/host/bounded-text';
import { SourceTools } from '../src/host/source-tools';

let fixture: string, project: string, file: string;
beforeEach(async () => {
  fixture = await mkdtemp(join(tmpdir(), 'syka-bounded-read-'));
  project = join(fixture, 'project'); await mkdir(project); file = join(project, 'index.tsx');
});
afterEach(async () => { await rm(fixture, { recursive: true, force: true }); });
type Edit = { sha256: string; historyId: string };

describe('bounded text snapshots and ranges', () => {
  it('caps the entire serialized response and reconstructs Unicode/CRLF text without overlap', async () => {
    const content = '\uFEFF' + '{"label":"Hola 😀"}\\\r\n'.repeat(2600);
    await writeFile(file, content);
    const snapshot = await readTextSnapshot(project, file);
    let options: TextReadOptions = {}, result = '', pages = 0;
    while (true) {
      const page = boundedTextRead(snapshot, options, { path: 'index.tsx' });
      expect(JSON.stringify(page).length).toBeLessThanOrEqual(24_000);
      expect(page.sha256).toBe(snapshot.sha256);
      expect(page.coverage.startOffset).toBe(result.length);
      result += page.content; pages++;
      if (!page.next) break;
      expect(page.content.length).toBeGreaterThan(0);
      expect(page.content.endsWith('\r')).toBe(false);
      expect(/[\uD800-\uDBFF]$/.test(page.content)).toBe(false);
      options = page.next as TextReadOptions;
      expect(pages).toBeLessThan(20);
    }
    expect(pages).toBeGreaterThan(1); expect(result).toBe(content);
    expect(() => boundedTextRead(snapshot, { maxChars: 96_001 })).toThrow(/96000/);
    expect(JSON.stringify(boundedTextRead(snapshot, { maxChars: 96_000 })).length).toBeLessThanOrEqual(96_000);
  });

  it('continues only the selected heading, then stops before the next section', async () => {
    const section = '## Target\r\n' + 'Chosen 😀 section.\r\n'.repeat(600);
    await writeFile(file, '# Intro\r\nContext\r\n' + section + '# Other\r\nDo not preload this.\r\n');
    const snapshot = await readTextSnapshot(project, file);
    let args: TextReadOptions = { mode: 'section', sectionId: 'target', maxChars: 2048 }, assembled = '', pages = 0;
    while (true) {
      const page = boundedTextRead(snapshot, args);
      expect(JSON.stringify(page).length).toBeLessThanOrEqual(2048);
      assembled += page.content; pages++;
      if (!page.next) { expect(page.requestedRangeComplete).toBe(true); break; }
      expect(page.next).toMatchObject({ mode: 'section', sectionId: 'target' });
      args = { ...(page.next as TextReadOptions), maxChars: 2048 };
      expect(pages).toBeLessThan(40);
    }
    expect(assembled).toBe(section);
    expect(() => boundedTextRead(snapshot, { mode: 'section', sectionId: 'target', offset: 0 })).toThrow(/outside/);
  });

  it('retains the requested line boundary through pages instead of reading the remainder', async () => {
    const line = 'Keep this line. '.repeat(400) + '\r\n';
    await writeFile(file, 'Before\r\n' + line + 'After must remain unread\r\n');
    const snapshot = await readTextSnapshot(project, file);
    let args: TextReadOptions = { mode: 'range', startLine: 2, lineCount: 1, maxChars: 1500 }, content = '';
    for (let pageNumber = 0; pageNumber < 30; pageNumber++) {
      const page = boundedTextRead(snapshot, args); content += page.content;
      if (!page.next) break;
      expect(page.next).toMatchObject({ mode: 'range', endOffset: 8 + line.length });
      args = { ...(page.next as TextReadOptions), maxChars: 1500 };
    }
    expect(content).toBe(line);
    expect(() => boundedTextRead(snapshot, { offset: 10, endOffset: 5 })).toThrow(/precedes/);
  });

  it('indexes headings outside fenced code and gives duplicates distinct identifiers', () => {
    const content = '# Real\n````js\n# Fake\n```\n# Still fake\n````\n## Repeated\nOne\n## Repeated\nTwo\n';
    expect(indexText(content).sections.map(section => section.id)).toEqual(['real', 'repeated', 'repeated-2']);
  });

  it('closes nested sections at the next sibling or ancestor heading', () => {
    const content='# Parent\nIntro\n## Child\nNested\n### Leaf\nBody\n## Sibling\nTail\n# Next\nDone\n';
    const sections=indexText(content).sections;
    const [parent,child,leaf,sibling]=sections;
    expect(parent!.endOffset).toBe(content.indexOf('# Next'));
    expect(child!.endOffset).toBe(content.indexOf('## Sibling'));
    expect(leaf!.endOffset).toBe(child!.endOffset);
    expect(sibling!.endOffset).toBe(parent!.endOffset);
  });

  it('searches literal text with exact original Unicode offsets and safe excerpts', async () => {
    const content = 'İ\r\n😀' + 'x'.repeat(119) + 'TARGET [x]+ .*\r\n';
    await writeFile(file, content);
    const snapshot = await readTextSnapshot(project, file);
    for (const query of ['target', '[x]+', '.*']) {
      const result = boundedTextRead(snapshot, { mode: 'search', query });
      const matches = result.matches as { offset: number; content: string }[];
      expect(matches).toHaveLength(1);
      expect(matches[0]!.offset).toBe(content.indexOf(query === 'target' ? 'TARGET' : query));
      expect(/^[\uDC00-\uDFFF]/.test(matches[0]!.content)).toBe(false);
      expect(result.coverage.fullFile).toBe(false);
    }
  });

  it('paginates search results without repeating a match or exceeding the ceiling', async () => {
    const content = 'match in this exact line\n'.repeat(160); await writeFile(file, content);
    const snapshot = await readTextSnapshot(project, file), offsets: number[] = [];
    let args: TextReadOptions = { mode: 'search', query: 'match', maxChars: 1500 };
    for (let pages = 0; pages < 100; pages++) {
      const result = boundedTextRead(snapshot, args);
      expect(JSON.stringify(result).length).toBeLessThanOrEqual(1500);
      offsets.push(...(result.matches as { offset: number }[]).map(match => match.offset));
      if (!result.next) break;
      args = { ...(result.next as TextReadOptions), maxChars: 1500 };
    }
    expect(offsets).toHaveLength(160); expect(new Set(offsets).size).toBe(160);
    expect(offsets).toEqual(Array.from({ length: 160 }, (_, index) => index * 25));
  });

  it('shares unchanged indexes but reads new contents after external edits and atomic replacement', async () => {
    await writeFile(file, 'First text');
    const original = await readTextSnapshot(project, file);
    expect(await readTextSnapshot(project, file)).toBe(original);
    await writeFile(file, 'Other text');
    await utimes(file, new Date(), new Date(Date.now() + 1000));
    const changed = await readTextSnapshot(project, file);
    expect(changed.content).toBe('Other text'); expect(changed.sha256).not.toBe(original.sha256);
    await writeFile(join(project, 'new.tsx'), 'Final text'); await rename(join(project, 'new.tsx'), file);
    expect((await readTextSnapshot(project, file)).content).toBe('Final text');
    const otherProject = join(fixture, 'other'); await mkdir(otherProject); await writeFile(join(otherProject, 'index.tsx'), 'Other project');
    expect((await readTextSnapshot(otherProject, join(otherProject, 'index.tsx'))).content).toBe('Other project');
  });

  it('rejects invalid UTF-8, binary, oversized and escaped files before returning text', async () => {
    await writeFile(file, Buffer.from([0xff, 0xfe])); await expect(readTextSnapshot(project, file)).rejects.toThrow(/UTF-8/);
    await writeFile(file, 'contains\0binary'); await expect(readTextSnapshot(project, file)).rejects.toThrow(/Binary/);
    await writeFile(file, Buffer.alloc(16 * 1024 * 1024 + 1)); await expect(readTextSnapshot(project, file)).rejects.toThrow(/16 MiB/);
    const outside = join(fixture, 'outside'); await mkdir(outside); await writeFile(join(outside, 'secret.tsx'), 'do not read');
    await symlink(outside, join(project, 'linked'), 'junction');
    await expect(readTextSnapshot(project, join(project, 'linked', 'secret.tsx'))).rejects.toThrow(/escapes/);
  });
});

describe('partial-read source edits', () => {
  it('patches one exact fragment and preserves unread bytes, undo, redo and cache freshness', async () => {
    const content = '\uFEFF// untouched 😀\r\n' + 'const padding = "value";\r\n'.repeat(1600) + 'const target = "before";\r\n';
    await writeFile(file, content);
    const source = new SourceTools(project), otherChat = new SourceTools(project);
    const read = await source.call('syka_read_source', { path: 'index.tsx', mode: 'search', query: 'target' }) as TextReadResult;
    expect(JSON.stringify(read).length).toBeLessThan(content.length / 10);
    await expect(source.call('syka_edit_source', { path: 'index.tsx', expectedSha256: read.sha256, content: 'partial overwrite' })).rejects.toThrow(/partial/);
    const edit = await source.call('syka_patch_source', { path: 'index.tsx', expectedSha256: read.sha256, oldText: 'const target = "before";', newText: 'const target = "after";' }) as Edit;
    const changed = content.replace('const target = "before";', 'const target = "after";');
    expect(await readFile(file, 'utf8')).toBe(changed);
    await expect(source.call('syka_edit_source', { path: 'index.tsx', expectedSha256: edit.sha256, content: 'still only know a fragment' })).rejects.toThrow(/partial/);
    expect(await otherChat.call('syka_read_source', { path: 'index.tsx', mode: 'search', query: 'target' })).toMatchObject({ sha256: edit.sha256, matches: [{ content: expect.stringContaining('"after"') }] });
    await source.call('syka_undo_source', { historyId: edit.historyId, expectedSha256: edit.sha256 });
    expect(await readFile(file, 'utf8')).toBe(content);
    await expect(source.call('syka_edit_source', { path: 'index.tsx', expectedSha256: read.sha256, content: 'undo did not disclose unread bytes' })).rejects.toThrow(/partial/);
    const restored = await otherChat.call('syka_read_source', { path: 'index.tsx', mode: 'range', startLine: 1, lineCount: 1 }) as TextReadResult;
    expect(restored.sha256).toBe(read.sha256);
    await source.call('syka_redo_source', { historyId: edit.historyId, expectedSha256: restored.sha256 });
    expect(await readFile(file, 'utf8')).toBe(changed);
  });

  it('allows a complete replacement after every page was actually read in this tool instance', async () => {
    const content = 'const preserved = "Hola 😀";\r\n'.repeat(2200); await writeFile(file, content);
    const source = new SourceTools(project); let args: TextReadOptions = {}, sha256 = '';
    for (let pageNumber = 0; pageNumber < 20; pageNumber++) {
      const page = await source.call('syka_read_source', { path: 'index.tsx', ...args }) as TextReadResult;
      sha256 = page.sha256; if (!page.next) break; args = page.next as TextReadOptions;
    }
    await source.call('syka_edit_source', { path: 'index.tsx', expectedSha256: sha256, content: content + '// done\r\n' });
    expect(await readFile(file, 'utf8')).toBe(content + '// done\r\n');
  });

  it('never grants or revokes coverage in another chat through the shared file cache', async () => {
    const content = '// complete source\nconst first = 1;\nconst last = 2;\n'; await writeFile(file, content);
    const first = new SourceTools(project), second = new SourceTools(project);
    const full = await first.call('syka_read_source', { path: 'index.tsx' }) as TextReadResult;
    const partial = await second.call('syka_read_source', { path: 'index.tsx', offset: 0, endOffset: 10 }) as TextReadResult;
    expect(partial.content).toBe(content.slice(0, 10)); expect(partial.sha256).toBe(full.sha256);
    await expect(second.call('syka_edit_source', { path: 'index.tsx', expectedSha256: full.sha256, content: 'discard unread bytes' })).rejects.toThrow(/partial/);
    await first.call('syka_edit_source', { path: 'index.tsx', expectedSha256: full.sha256, content: content + '// preserved\n' });
    await expect(second.call('syka_patch_source', { path: 'index.tsx', expectedSha256: full.sha256, oldText: 'first = 1', newText: 'first = 2' })).rejects.toThrow(/changed/);
  });

  it('rejects ambiguous, missing, stale and escaping patches without changing files', async () => {
    const content = 'repeat repeat\nunique\n'; await writeFile(file, content);
    const source = new SourceTools(project);
    const read = await source.call('syka_read_source', { path: 'index.tsx' }) as TextReadResult;
    const patch = { path: 'index.tsx', expectedSha256: read.sha256, newText: 'changed' };
    await expect(source.call('syka_patch_source', { ...patch, oldText: 'repeat' })).rejects.toThrow(/ambiguous/);
    await expect(source.call('syka_patch_source', { ...patch, oldText: 'missing' })).rejects.toThrow(/not found/);
    await expect(source.call('syka_patch_source', { ...patch, oldText: '' })).rejects.toThrow(/nonempty/);
    await writeFile(join(fixture, 'outside.tsx'), 'outside');
    await expect(source.call('syka_patch_source', { ...patch, path: '../outside.tsx', oldText: 'outside' })).rejects.toThrow(/inside/);
    expect(await readFile(file, 'utf8')).toBe(content);
  });

  it('refuses malformed Unicode fragments instead of corrupting an unread surrogate pair', async () => {
    const content = 'const title = "😀";\r\n'; await writeFile(file, content);
    const source = new SourceTools(project);
    const read = await source.call('syka_read_source', { path:'index.tsx' }) as TextReadResult;
    const base = {path:'index.tsx',expectedSha256:read.sha256};
    await expect(source.call('syka_patch_source',{...base,oldText:'\uD83D',newText:'x'})).rejects.toThrow(/Unicode/);
    await expect(source.call('syka_patch_source',{...base,oldText:'😀',newText:'\uDC00'})).rejects.toThrow(/Unicode/);
    await expect(source.call('syka_edit_source',{...base,content:'broken\uD83D'})).rejects.toThrow(/UTF-8/);
    expect(await readFile(file,'utf8')).toBe(content);
  });
});
