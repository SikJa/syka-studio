import { describe, expect, it } from 'vitest';
import { motionPlan } from '../src/host/motion-plan';
import { narrationCues } from '../src/host/narration-cues';
import { WorkspaceTools } from '../src/host/workspace-tools';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';

function launch() {
  const input: Record<string, any> = {
    brief: { purpose: 'Demostrar una selección', audience: 'Editores', useCase: 'product-launch', language: 'es',
      delivery: { width: 1920, height: 1080, durationSeconds: 12, fps: 30, destination: 'Anuncio' }, copy: ['Elegí tu título'],
      direction: 'Vidrio oscuro y foco claro', typography: { families: ['Inter'], hierarchy: 'Título 84px', layout: 'Producto centrado', palette: ['#090909', '#ffffff'], safeArea: '80px' },
      motion: { grammar: 'Acción y respuesta con pausa', continuity: 'Misma ventana' },
      audio: { mode: 'music+sfx', voice: 'Toma existente elegida', selection: 'Música elegante y selección breve', mix: 'Voz despejada' },
      references: [{ id: 'study', source: 'docs/study.md', observation: 'Acción y respuesta', apply: 'Continuidad', avoid: 'Paleta ajena', evidence: 'written-study' }], assets: [], constraints: [] },
    consultation: [{ question: '¿Sonido?', answer: 'Música y efectos con voz', fields: ['audio'] }],
    beats: [{ id: 'phrase', start: 0, end: 12, purpose: 'Demostrar selección', copy: ['Elegí tu título'], layout: 'Ventana central', entry: 'Desde primer cuadro', holdStart: .4, holdEnd: 11.5, exit: 'Corte limpio', bridge: 'Resultado', review: ['Comprobar resultado real'] }],
  };
  input.brief.audio.microActions = 'detailed';
  input.brief.motion.holdActivity = 'ambient';
  input.brief.deliverables = [{ kind: 'vertical', purpose: 'Campaña móvil', width: 1080, height: 1920 }];
  input.beats[0].demo = { trigger: 'Seleccionar título', reaction: 'Aplicar color', result: 'Título actualizado', evidence: 'Captura del proyecto preparado' };
  input.narration = { asset: 'Audio/voz.wav', timelineStartSeconds: 2, sourceInSeconds: .5, playbackRate: 2,
    words: [{ word: 'Seleccioná', start: 1, end: 1.4 }, { word: 'título', start: 2, end: 2.6 }] };
  input.events = [{ id: 'select', beat: 'phrase', at: 'start', kind: 'visual', description: 'Seleccionar título', element: 'phrase-text', wordCue: { index: 1, edge: 'start' } },
    { id: 'tick', beat: 'phrase', at: 'start', kind: 'sfx', description: 'Acento de selección', asset: 'Audio/tick.wav', assetCuePointSeconds: .08, wordCue: { index: 1, edge: 'start' } }];
  return input;
}
describe('native launch and measured narration plan', () => {
  it('exposes the bundled recipe and support files through the actual host tools offline', async () => {
    const tools = new WorkspaceTools(process.cwd(), resolve('docs'));
    const result = await tools.call('syka_motion_plan', launch()) as ReturnType<typeof motionPlan>;
    expect(result.plan?.events[0]?.plannedSeconds).toBe(2.75);
    const path = resolve('docs/skills/syka-product-launch');
    for (const file of ['SKILL.md', 'references/twelve-rules.md', 'references/narration-sync.md', 'examples/ProductDemo.tsx', 'examples/ProductFocus.tsx', 'examples/LaunchCover.tsx', 'examples/launch-time.ts']) {
      const actual = await tools.call('syka_skills', { action: 'read', path, file }) as { content: string };
      expect(actual.content).toBe(await readFile(resolve(path, file), 'utf8'));
    }
    const knowledge = await tools.call('syka_motion_knowledge', { id: 'stack-amanda-sartini-launch-rules', includeText: true }) as { results: { sourceAccessible: boolean; sourceStorage: string }[] };
    expect(knowledge.results).toHaveLength(1);
    expect(knowledge.results[0]).toMatchObject({ sourceAccessible: true, sourceStorage: 'bundled_original_study' });
  });
  it('maps an actual word with trim/rate into the shared visual/SFX clock', () => {
    const result = motionPlan(launch());
    expect(result.plan?.events[0]).toMatchObject({ plannedSeconds: 2.75, frame: 83, nativeAnchor: { offsetSeconds: 2.75 }, wordCue: { text: 'título', sourceSeconds: 2 } });
    expect(result.plan?.events[1]).toMatchObject({ plannedSeconds: 2.75, mediaStartSeconds: 2.67 });
    expect(result.plan?.narration?.evidence).toBe('provided-word-timings');
    expect(result.plan?.skills).toContain('syka-product-launch');
    expect(result.plan?.launchReview).toHaveLength(12);
    expect(result.plan?.launchReview.every(r => r.state === 'needs_inspection')).toBe(true);
  });
  it('recalculates event, fingerprint and document views when the take changes', () => {
    const input = launch(), first = motionPlan(input);
    input.narration.words[1].start = 2.2;
    const second = motionPlan(input);
    expect(second.plan?.events[0]?.plannedSeconds).toBe(2.85);
    expect(second.plan?.narration?.timingRevision).not.toBe(first.plan?.narration?.timingRevision);
    expect(second.documents?.['audio-plan.md']).toContain('composición 2.85 s');
    expect(second.shortPrompts?.[0]?.prompt).toContain('2.85 s');
    expect(second.plan?.events[0]?.wordCue?.timingRevision).toBe(second.plan?.narration?.timingRevision);
  });
  it('derives both prompt sizes from the same brand, audio and demonstration', () => {
    const input = launch(), result = motionPlan(input);
    expect(result.shortPrompts?.[0]?.parts).toHaveLength(8);
    expect(result.productionPrompt).toContain(input.beats[0].demo.result);
    expect(result.shortPrompts?.[0]?.prompt).toContain(input.beats[0].demo.result);
    expect(result.plan?.brief.audio.microActions).toBe('detailed');
    expect(result.plan?.brief.motion.holdActivity).toBe('ambient');
    expect(result.plan?.brief.deliverables).toEqual(input.brief.deliverables);
    expect(result.documents?.['launch-checklist.md']).toContain('needs_inspection');
    input.brief.direction = 'Marca cambiada';
    const changed = motionPlan(input);
    expect(changed.documents?.['design.md']).toContain('Marca cambiada');
    expect(changed.shortPrompts?.[0]?.prompt).toContain('Marca cambiada');
  });
  it('rejects absent/trimmed/invalid words, double offsets and conflicting sound', () => {
    const input = launch();
    delete input.narration;
    expect(() => motionPlan(input)).toThrow('necesita');
    input.narration = launch().narration; input.narration.sourceInSeconds = 2.1;
    expect(() => motionPlan(input)).toThrow('recortada');
    input.narration = launch().narration; input.events[0].wordCue.index = 1.5;
    expect(() => motionPlan(input)).toThrow('rango');
    input.events[0].wordCue.index = 1; input.events[0].offsetSeconds = .2;
    expect(() => motionPlan(input)).toThrow('dos offsets');
    delete input.events[0].offsetSeconds; input.brief.audio.mode = 'silent';
    expect(() => motionPlan(input)).toThrow('microacciones');
  });
  it('does not estimate timing from text or accept broken source ranges', () => {
    expect(() => narrationCues({ asset: 'Audio/voice.wav', words: [{ word: 'hola', start: 1, end: .8 }] })).toThrow('rango');
    expect(() => narrationCues({ asset: 'Audio/voice.wav', words: [{ word: 'hola', start: NaN, end: 2 }] })).toThrow('rango');
    expect(() => narrationCues({ asset: '../voice.wav', words: [] })).toThrow('portable');
    expect(() => narrationCues({ asset: '  C:/Users/Example/voice.wav', words: [] })).toThrow('portable');
    expect(() => narrationCues({ asset: 'file:///outside.wav', words: [] })).toThrow('portable');
    expect(() => narrationCues({ asset: 'Audio/voice.wav', words: [{ word: 'a', start: 2, end: 3 }, { word: 'b', start: 1, end: 2 }] })).toThrow('ordenar');
    expect(() => narrationCues({ asset: 'Audio/voice.wav', words: [{ word: 'hola' }] })).toThrow('rango');
  });
  it('fails if retiming moves the word outside its demonstration beat', () => {
    const input = launch(); input.beats[0].start = 3; input.beats[0].holdStart = 3.4;
    expect(() => motionPlan(input)).toThrow('fuera de su beat');
  });
});
