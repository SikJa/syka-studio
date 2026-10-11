import { describe, it, expect } from 'vitest';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { Project, SyntaxKind } from 'ts-morph';
import { applyEdits } from '../../../../desktop/src/edit';
import { FORMAT_PROP, parseDecision, planAdaptation, PRESETS } from './model';

describe('native source persistence', () => {
  it('writes dimensions, layout and decision to JSX; reopens and reverses without touching timing/media', async () => {
    const root = resolve('.runtime/format-source-tests'); await mkdir(root, { recursive: true });
    const dir = await mkdtemp(join(root, 'case-'));
    const file = join(dir, 'main.tsx');
    await writeFile(file, 'export default () => <scene id="scene" width={1920} height={1080}><rect id="clip" width={1920} height={1080} start={3} end={8}><videoPaint id="paint" src="assets/source.mp4"/></rect></scene>;');
    const decision = { version: 1 as const, mode: 'manual' as const, provenance: 'manual' as const, revision: 1, destination: 'reels' as const };
    const plan = planAdaptation(PRESETS['16:9'], PRESETS['9:16'], [{ id: 'clip', tag: 'rect', props: { width: 1920, height: 1080 }, children: [{ id: 'paint', tag: 'videoPaint', props: { src: 'assets/source.mp4' }, children: [] }] }]);
    const result = await applyEdits({ dir }, [
      { kind: 'set', source: 'main.tsx:scene', props: { width: 1080, height: 1920, [FORMAT_PROP]: JSON.stringify(decision) } },
      { kind: 'set', source: 'main.tsx:clip', props: plan.changes[0].props },
    ]);
    expect(result).toBeDefined();
    const saved = await readFile(file, 'utf8');
    const project = new Project({ useInMemoryFileSystem: true });
    const reopened = project.createSourceFile('main.tsx', saved);
    const attr = reopened.getDescendantsOfKind(SyntaxKind.JsxAttribute).find(a => a.getNameNode().getText() === FORMAT_PROP)!;
    const literal = attr.getFirstDescendantByKind(SyntaxKind.StringLiteral)!;
    expect(parseDecision(literal.getLiteralValue())).toMatchObject(decision);
    expect(saved).toContain('width={1080}'); expect(saved).toContain('height={1920}');
    expect(saved).toContain('start={3} end={8}'); expect(saved).toContain('src="assets/source.mp4"');
    await applyEdits({ dir }, [
      { kind: 'set', source: 'main.tsx:scene', props: { width: 1920, height: 1080, [FORMAT_PROP]: false } },
      { kind: 'set', source: 'main.tsx:clip', props: { width: 1920, height: 1080, x: false, y: false } },
    ]);
    const reverted = await readFile(file, 'utf8');
    expect(reverted).not.toContain(FORMAT_PROP);
    expect(reverted).toContain('start={3} end={8}'); expect(reverted).toContain('src="assets/source.mp4"');
    expect(reverted).toContain('width={1920} height={1080}');
  });
});

