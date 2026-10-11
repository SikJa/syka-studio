/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SourceTools } from '../src/host/source-tools';

let fixture: string;
let project: string;
let folder: string;
let tools: SourceTools;
const transcript = { segments: [{ text: 'Hola Syka', words: [
  { text: 'Hola', start: 0.15, end: 0.48 },
  { text: 'Syka', start: 0.62, end: 1.2 },
] }] };
const relativeTranscript = '03 Assets reutilizables/Transcripciones/speech.json';
beforeEach(async () => {
  fixture = await mkdtemp(join(tmpdir(), 'syka-transcript-reader-'));
  project = join(fixture, 'project');
  folder = join(project, '03 Assets reutilizables', 'Transcripciones');
  await mkdir(folder, { recursive: true });
  await writeFile(join(folder, 'speech.json'), JSON.stringify(transcript));
  tools = new SourceTools(project);
});
afterEach(async () => { await rm(fixture, { recursive: true, force: true }); });

describe('chat transcript reading', () => {
  it('returns actual word times with paging, without modifying the transcript', async () => {
    const before = await readFile(join(folder, 'speech.json'), 'utf8');
    expect(await tools.call('syka_read_transcript', { path: relativeTranscript, offset: 0, limit: 1 })).toMatchObject({
      text: 'Hola', words: [transcript.segments[0]!.words[0]], totalWords: 2, nextOffset: 1,
    });
    expect(await tools.call('syka_read_transcript', { path: join(folder, 'speech.json'), offset: 1, limit: 500 })).toMatchObject({
      text: 'Syka', words: [transcript.segments[0]!.words[1]], totalWords: 2, nextOffset: null,
    });
    expect(await readFile(join(folder, 'speech.json'), 'utf8')).toBe(before);
    await expect(tools.call('syka_edit_source', { path: relativeTranscript, expectedSha256: '0'.repeat(64), content: '{}' })).rejects.toThrow(/cannot be edited/);
  });

  it('rejects outside paths, other project files, malformed pagination and malformed word timing', async () => {
    await writeFile(join(fixture, 'outside.json'), JSON.stringify(transcript));
    for (const path of [join(fixture, 'outside.json'), '../../outside.json', 'package.json']) {
      await expect(tools.call('syka_read_transcript', { path, offset: 0, limit: 200 })).rejects.toThrow(/Only transcript/);
    }
    for (const args of [{ offset: -1, limit: 20 }, { offset: 0, limit: 501 }, { offset: 0.5, limit: 20 }]) {
      await expect(tools.call('syka_read_transcript', { path: relativeTranscript, ...args })).rejects.toThrow(/1-500/);
    }
    await writeFile(join(folder, 'speech.json'), JSON.stringify({ segments: [{ text: 'no actual times' }] }));
    await expect(tools.call('syka_read_transcript', { path: relativeTranscript, offset: 0, limit: 20 })).rejects.toThrow(/real word times/);
    await writeFile(join(folder, 'speech.json'), JSON.stringify({ segments: [{ words: [{ text: 'bad', start: 3, end: 1 }] }] }));
    await expect(tools.call('syka_read_transcript', { path: relativeTranscript, offset: 0, limit: 20 })).rejects.toThrow(/timing/);
  });

  it('refuses junctions pointing at transcript data outside the open project', async () => {
    const outside = join(fixture, 'outside');
    await mkdir(outside);
    await writeFile(join(outside, 'speech.json'), JSON.stringify(transcript));
    await symlink(outside, join(folder, 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
    await expect(tools.call('syka_read_transcript', { path: '03 Assets reutilizables/Transcripciones/escape/speech.json', offset: 0, limit: 20 })).rejects.toThrow(/escapes/);
  });
});
