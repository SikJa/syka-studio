import { describe, expect, it, vi } from 'vitest';
import { mkdtemp, copyFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
vi.mock('electron', () => ({ app: { isPackaged: false, getPath: () => tmpdir() }, dialog: {}, shell: {}, ipcMain: { on: () => {} } }));
vi.stubGlobal('require', createRequire(import.meta.url));
const { compileProject } = await import('../src/projects');

describe('portable native camera caption example', () => {
  it('compiles copied support files in a fresh project with the actual Diffusion compiler', async () => {
    const root = await mkdtemp(join(tmpdir(), 'syka-caption-compile-'));
    try {
      const example = resolve(import.meta.dirname, '../../../docs/skills/syka-camera-3d-captions/examples');
      for (const file of ['DepthCaption.tsx', 'projection.ts']) await copyFile(join(example, file), join(root, file));
      await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'caption-fixture', main: 'index.tsx', displayName: 'Caption fixture', projectId: 'caption-fixture' }));
      await writeFile(join(root, 'index.tsx'), `import {DepthCaption} from './DepthCaption';
export default () => <stage><scene id="caption-scene" width={1920} height={1080} active>
<DepthCaption id="caption" text="Texto editable" point={{x:0,y:0,z:0}} cameraAt={t=>({x:40*Math.sin(t),y:0,z:-1200,focal:1200,centerX:960,centerY:540})}
start={0} end={12} width={1100} fontSize={84} fontFamily="Inter" color="#ffffff" />
</scene></stage>;`);
      const result = await compileProject(root);
      expect(result, result.ok ? undefined : result.error).toMatchObject({ ok: true });
      if (result.ok) { expect(result.code).toContain('Texto editable'); expect(result.code).toContain('projectCaption'); }
    } finally { await rm(root, { recursive: true, force: true }); }
  }, 20000);
});
