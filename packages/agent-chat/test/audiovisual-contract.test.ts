import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { projectDelivery } from '../src/host/project-delivery';
import { onboardingMemory } from '../src/host/onboarding-memory';
import { chatInstructions } from '../src/host/harness';
import { AUDIOVISUAL_CONTRACT } from '../src/host/audiovisual-contract';
import { parseUserQuestions, USER_QUESTION_TOOL } from '../src/host/user-questions';

let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'syka-audiovisual-'));
  await writeFile(join(root, 'package.json'), JSON.stringify({ projectId: 'scope-test' }));
  await writeFile(join(root, 'index.tsx'), 'export default <scene><html start={0} end={16}>Juego animado</html></scene>');
  await mkdir(join(root, 'juego'));
  await writeFile(join(root, 'juego', 'index.html'), '<button>Jugar</button>');
});
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

describe('audiovisual product scope', () => {
  it('rejects the Wild Mountain standalone game even in review, while preserving native editing when preview fails', async () => {
    await expect(projectDelivery(root, { status: 'review', message: 'Preview pendiente', artifact: 'juego/index.html' })).rejects.toThrow('composición nativa');
    await expect(projectDelivery(root, { status: 'review', message: 'Worker caído; falta preview', artifact: 'index.tsx' })).resolves.toMatchObject({ kind: 'review', artifact: join(root, 'index.tsx') });
    await expect(projectDelivery(root, { status: 'ready', message: 'Listo', artifact: 'index.tsx' })).rejects.toThrow('evidencia');
  });
  it('allows mixed audiovisual media and supporting plans without delivering arbitrary code as a completed edit', async () => {
    for (const file of ['voice.wav', 'captions.srt', 'frame.md', 'server.js', 'component.tsx']) await writeFile(join(root, file), 'fixture');
    for (const file of ['voice.wav', 'captions.srt', 'frame.md']) await expect(projectDelivery(root, { status: 'review', message: 'Revisar', artifact: file })).resolves.toHaveProperty('kind', 'review');
    for (const file of ['server.js', 'component.tsx', 'frame.md']) await expect(projectDelivery(root, { status: 'ready', message: 'Listo', artifact: file, evidence: ['frame.md'] })).rejects.toThrow('audiovisual');
  });
  it('keeps the scope host-owned across old accepted answers and later corrections', async () => {
    const old = await onboardingMemory(root, { action: 'answer', relevant: ['purpose'], revision: 0, key: 'purpose', state: 'accepted', source: 'user', value: 'Juego interactivo' });
    expect(old.productScope.delivery).toBe('native-editable-composition');
    const corrected = await onboardingMemory(root, { action: 'answer', relevant: ['purpose'], revision: old.revision, key: 'purpose', state: 'accepted', source: 'user', value: 'Motion con este estilo de juego, voz y subtítulos' });
    expect(corrected.accepted.purpose).toContain('Motion');
    expect(corrected.productScope).toEqual(old.productScope);
    expect(corrected.nextQuestion).toBeNull();
  });
  it('does not ban game words in valid audiovisual questions; scope is in every shared harness instruction', () => {
    expect(parseUserQuestions({ questions: [{ id: 'look', question: '¿Qué debe mostrar el motion del juego?', options: [{ label: 'Resolver la crisis en tres escenas' }] }] })).toHaveLength(1);
    expect(chatInstructions(root, 'Old plan: build an interactive game')).toContain(AUDIOVISUAL_CONTRACT);
    expect(USER_QUESTION_TOOL.description).toContain('Never offer a playable game');
  });
});
