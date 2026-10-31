import { afterEach, describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { projectSnapshot, RESEARCH_PROTOCOL } from '../src/host/first-turn';
import { progressiveChatInstructions } from '../src/host/task-guidance';

const roots: string[] = [];
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });

describe('first message research', () => {
  it('indexes project documents, sources, saved state and folders without reading contents', async () => {
    const root = await mkdtemp(join(tmpdir(), 'syka-first-')); roots.push(root);
    await writeFile(join(root, 'BRIEF.md'), 'secret brief text');
    await writeFile(join(root, 'PROMPT-EDICION.md'), 'x'.repeat(4096));
    await writeFile(join(root, 'index.tsx'), 'export default 1');
    await writeFile(join(root, 'vite.config.ts'), '');
    await mkdir(join(root, '.syka'), { recursive: true }); await writeFile(join(root, '.syka', 'editing-recipe.json'), '{}');
    await mkdir(join(root, '03 Assets reutilizables', 'Transcripciones'), { recursive: true });
    await writeFile(join(root, '03 Assets reutilizables', 'Transcripciones', 'a.json'), '{}');
    await mkdir(join(root, '90 Descartable'));
    const snapshot = await projectSnapshot(root);
    expect(snapshot).toContain('BRIEF.md (17 B)');
    expect(snapshot).toContain('PROMPT-EDICION.md (4 KB)');
    expect(snapshot).toContain('Composition sources: index.tsx.');
    expect(snapshot).toContain('editing recipe');
    expect(snapshot).toContain('03 Assets reutilizables: 0 files (Transcripciones 1)');
    expect(snapshot).not.toContain('secret brief text');
    expect(snapshot).not.toContain('vite.config');
    expect(snapshot).not.toContain('90 Descartable');
    expect(await projectSnapshot(join(root, 'missing'))).toBe('');
  });
  it('is part of the progressive instructions, ahead of the small-correction rules', () => {
    const instructions = progressiveChatInstructions('E:/project');
    expect(instructions).toContain(RESEARCH_PROTOCOL);
    expect(instructions.indexOf('Research phase')).toBeLessThan(instructions.indexOf('A small clear correction'));
  });
  const real = 'E:\\Syka Studio\\Motions\\champisikoraa-clips-lote-20261023\\D10-01';
  it.skipIf(!existsSync(real))('summarizes a real project in a small bounded block', async () => {
    const snapshot = await projectSnapshot(real);
    console.log(snapshot);
    expect(snapshot.length).toBeLessThan(3000);
  });
});
