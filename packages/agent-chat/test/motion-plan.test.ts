import { describe, expect, it } from 'vitest';
import { motionPlan, MOTION_USES } from '../src/host/motion-plan';
import { WorkspaceTools, WORKSPACE_TOOLS } from '../src/host/workspace-tools';
import { chatInstructions } from '../src/host/harness';

export const fixture = () => ({
  brief: { purpose: 'Mostrar que el silencio comunica', audience: 'Personas que ven un reel en el móvil', useCase: 'typography', language: 'es',
    delivery: { width: 1080, height: 1920, durationSeconds: 12, fps: 30, destination: 'Reel' }, copy: ['El silencio también habla'],
    direction: 'Una frase que aparece y deja espacio para leer, con un cierre suave',
    typography: { families: ['Inter'], hierarchy: 'Título 84px, apoyo 40px', layout: 'Centro óptico, una frase protagonista', palette: ['#111111', '#eeeeee'], safeArea: '96px laterales y 180px arriba/abajo' },
    motion: { grammar: 'Entrada breve, hold estable, salida que reduce contraste', continuity: 'La misma frase mantiene posición durante el hold' },
    audio: { mode: 'music+sfx', voice: 'Sin voz', selection: 'Música ambiental discreta y un ataque suave', mix: 'Sin click por palabra, preservar el silencio final' },
    references: [{ id: 'study-type', source: 'docs/typography-study.md', observation: 'Jerarquía y hold como principio escrito', apply: 'Una frase legible', avoid: 'No copiar su paleta', evidence: 'written-study' }], assets: [], constraints: ['La palabra más larga no debe recortarse'] },
  consultation: [{ question: '¿Querés música y efectos o silencio?', answer: 'Ambos, suaves y sin voz', fields: ['audio'] }],
  beats: [{ id: 'phrase', start: 0, end: 12, purpose: 'Presentar la idea', copy: ['El silencio también habla'], layout: 'Frase centrada', entry: '24px y opacidad en .4s', holdStart: .4, holdEnd: 11.5, exit: 'Opacidad en .5s', bridge: 'Cierre quieto', review: ['Leer a 360px', 'Comprobar clipping'] }],
  events: [{ id: 'phrase-exit', beat: 'phrase', at: 'holdEnd', kind: 'review', description: 'Revisar la salida', element: 'phrase-text' }],
});

describe('production plan compiler', () => {
  it('asks for sound and delivery in every use case without silently choosing them', () => {
    for (const useCase of MOTION_USES) {
      const result = motionPlan({ brief: { purpose: 'Una idea', useCase } });
      expect(result.state).toBe('needs_answers');
      expect(result.missing).toContain('audio.mode');
      expect(result.missing).toContain('delivery.durationSeconds');
      expect(result.questions?.some(q => q.id === 'sound-direction')).toBe(true);
      expect(result.questions?.length).toBeLessThanOrEqual(3);
      expect(result).not.toHaveProperty('productionPrompt');
    }
  });
  it('produces a detailed prompt and portable data from the same resolved answers', async () => {
    const tools = new WorkspaceTools(process.cwd()), result = await tools.call('syka_motion_plan', fixture()) as ReturnType<typeof motionPlan>;
    expect(result.state).toBe('ready');
    expect(result.productionPrompt?.length).toBeGreaterThan(3000);
    expect(result.productionPrompt).toContain('Ambos, suaves y sin voz');
    expect(result.plan?.events[0]).toMatchObject({ id: 'phrase-exit', plannedSeconds: 11.5, frame: 345, nativeAnchor: { element: 'phrase-text', edge: 'start', offsetSeconds: 11.5 } });
    expect(result.plan?.skills).toContain('syka-motion-typography');
    expect(WORKSPACE_TOOLS.some(tool => tool.name === 'syka_motion_plan')).toBe(true);
    expect(chatInstructions('project')).toContain('Sound is a universal intake decision');
    expect(chatInstructions('project')).toContain('syka_motion_plan');
  });
  it('derives every cue again after a beat timing change', () => {
    const input = fixture(); input.beats[0]!.holdEnd = 10.5;
    const result = motionPlan(input);
    expect(result.plan?.events[0]?.plannedSeconds).toBe(10.5);
    expect(result.productionPrompt).toContain('10.500 s planificados');
    expect(result.documents?.['frame.md']).toContain('10.500 s');
    expect(result.documents?.['design.md']).toContain(input.brief.direction);
    expect(result.documents?.['audio-plan.md']).toContain(input.brief.audio.mix);
    expect(result.documents?.['audio-plan.md']).not.toContain('phrase-exit');
  });
  it('keeps sound cues in the same plan and does not parse user headings as document boundaries',()=>{
    const input=fixture();input.brief.direction+='\n\n## structure\nEsta frase es parte de la dirección.';
    input.events[0]!.kind='sfx';
    const result=motionPlan(input);
    expect(result.documents?.['design.md']).toContain(input.brief.direction);
    expect(result.documents?.['audio-plan.md']).toContain('phrase-exit: 11.500 s');
    input.brief.references=[];
    const missing=motionPlan(input);
    expect(missing.state).toBe('needs_structure');
    expect(missing.questions).toEqual([]);
  });
  it('does not manufacture a completed consultation or build before structure is ready', () => {
    const input = fixture(); input.consultation = [];
    expect(motionPlan(input).missing).toContain('consultation');
    const ready = fixture(); ready.beats = [];
    expect(motionPlan(ready).state).toBe('needs_structure');
  });
  it('rejects mismatched sound, duplicated IDs, bad reading windows and unapproved copy', () => {
    const sound = fixture(); sound.brief.audio.mode = 'silent'; sound.events[0]!.kind = 'sfx';
    expect(() => motionPlan(sound)).toThrow('silencioso');
    const duplicates = fixture(); duplicates.events.push(duplicates.events[0]!);
    expect(() => motionPlan(duplicates)).toThrow('duplicado');
    const hold = fixture(); hold.beats[0]!.holdEnd = 13;
    expect(() => motionPlan(hold)).toThrow('rango');
    const copy = fixture(); copy.beats[0]!.copy = ['Claim inventado'];
    expect(() => motionPlan(copy)).toThrow('copy');
  });
  it('rejects personal absolute asset paths and unknown fields', () => {
    const input = fixture() as Record<string, any>;
    input.brief.assets = [{ path: 'C:/Users/example/song.mp3', role: 'music', rights: 'personal' }];
    expect(() => motionPlan(input)).toThrow('portables');
    expect(() => motionPlan({ ...fixture(), inventedApproval: true })).toThrow('desconocido');
  });
  it('separates reference functions and retains older briefs', () => {
    expect(motionPlan(fixture()).plan?.brief.references[0]!.roles).toEqual(['general']);
    const input = fixture() as Record<string, any>;
    input.brief.references[0].roles = ['movement', 'audio', 'movement'];
    const result = motionPlan(input);
    expect(result.plan?.brief.references[0]!.roles).toEqual(['movement', 'audio']);
    expect(result.productionPrompt).toContain('función: movement, audio');
    input.brief.references[0].roles = ['invented'];
    expect(() => motionPlan(input)).toThrow('referencia desconocida');
  });
  it('aligns the measured asset attack and recalculates its start after retiming', () => {
    const input = fixture() as Record<string, any>;
    input.events[0] = { ...input.events[0], kind: 'sfx', asset: 'Audio/chime.wav', assetCuePointSeconds: .25 };
    expect(motionPlan(input).plan?.events[0]).toMatchObject({ plannedSeconds: 11.5, mediaStartSeconds: 11.25 });
    input.beats[0].holdEnd = 10.5;
    const result = motionPlan(input);
    expect(result.plan?.events[0]).toMatchObject({ plannedSeconds: 10.5, mediaStartSeconds: 10.25 });
    expect(result.documents?.['audio-plan.md']).toContain('ataque medido a 0.25');
    input.events[0].assetCuePointSeconds = 11;
    expect(motionPlan(input).warnings?.join(' ')).toContain('preroll');
    input.events[0].asset = '../outside.wav';
    expect(() => motionPlan(input)).toThrow('portable');
    input.events[0].asset = 'Audio/chime.wav'; input.events[0].kind = 'visual';
    expect(() => motionPlan(input)).toThrow('sonoro');
  });
  it('keeps sound character and visual action with the shared cue after retiming', () => {
    const input = fixture() as Record<string, any>;
    Object.assign(input.brief.audio, { sonicFamily: 'Vidrio y aire', intensity: 'Suave, un solo acento', space: 'Seco y cercano' });
    Object.assign(input.events[0], { kind: 'sfx', visualAction: 'land', weight: 'hero', material: 'glass', asset: 'Audio/glass.ogg', assetCuePointSeconds: .04 });
    const first = motionPlan(input);
    expect(first.plan?.brief.audio).toMatchObject({ sonicFamily: 'Vidrio y aire', space: 'Seco y cercano' });
    expect(first.plan?.events[0]).toMatchObject({ visualAction: 'land', weight: 'hero', material: 'glass', mediaStartSeconds: 11.46 });
    expect(first.documents?.['audio-plan.md']).toContain('Vidrio y aire');
    input.beats[0].holdEnd = 10;
    expect(motionPlan(input).plan?.events[0]).toMatchObject({ visualAction: 'land', mediaStartSeconds: 9.96 });
    input.events[0].visualAction = 'made-up';
    expect(() => motionPlan(input)).toThrow('Acción sonora');
    input.events[0].visualAction = 'land'; input.events[0].kind = 'review'; delete input.events[0].assetCuePointSeconds;
    expect(() => motionPlan(input)).toThrow('cue SFX');
  });
});
