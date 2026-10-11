import { describe, expect, it } from 'vitest';
import { chatInstructions } from '../src/host/harness';
import { EDITORIAL_INSTRUCTIONS } from '../src/host/editorial-instructions';

describe('editorial instructions shared by provider harnesses', () => {
  it('includes the design and visual review contract once in the shared instructions', () => {
    const text = chatInstructions('C:/project', 'Preserve the approved palette.');
    expect(text).toContain('C:/project');
    expect(text).toContain('Preserve the approved palette.');
    expect(text.split(EDITORIAL_INSTRUCTIONS)).toHaveLength(2);
    for (const workflow of ['syka-visual-direction', 'syka-music-video', 'syka-pr-to-video', 'syka-slideshow']) {
      expect(text).toContain(workflow);
    }
    expect(text).toContain('elementSnapshotSha256');
  });
});
