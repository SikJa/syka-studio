import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { planTool, recetaTool, entregaBloqueada, ofertaDeReceta } from '../src/host/plan/tools';
import { validarReceta } from '../src/host/plan/receta';
import { writeGateReceipt, planLines } from '../src/host/plan/gate-receipt';
import { projectDelivery } from '../src/host/project-delivery';

const docs = resolve(__dirname, '../../../docs');
let project: string, personal: string;
beforeEach(async () => {
  project = await mkdtemp(join(tmpdir(), 'syka-plan-'));
  personal = await mkdtemp(join(tmpdir(), 'syka-recetas-'));
  await writeFile(join(project, 'index.tsx'), 'export default () => null;\n');
});
afterEach(async () => { await rm(project, { recursive: true, force: true }); await rm(personal, { recursive: true, force: true }); });

const plano = (at: number, distancia = 'panel', movimiento = 'acercar') => ({ at, distancia, pantalla: 'el editor', movimiento, destino: 'el botón Exportar' });
const escena = (id: string, inicio: number, fin: number, seccion: string, frase: string, costura = 'corte-en-movimiento') =>
  ({ id, inicio, fin, seccion, frase, imagen: 'la UI real', planos: [plano(inicio + 0.5)], costura: { tipo: costura }, assets: [] });
const escenas = () => [
  escena('gancho', 0, 3, 'gancho', 'Tus videos tardan días'),
  escena('nombre', 3, 6, 'presentacion', 'Presentamos Syka Studio'),
  escena('demo', 6, 16, 'demo', 'Pedilo y se edita'),
  escena('resultado', 16, 20, 'resultado', 'Listo en minutos'),
  escena('logo', 20, 24, 'cierre', 'Syka Studio'),
];
const sonido = { modo: 'musica', tema: { ruta: '03 Assets reutilizables/Audio/Mixkit/x.mp3', fuente: 'Mixkit', licencia: 'Mixkit Free' }, beats: [0.5, 1] };

async function planHastaEscenas(usar = true) {
  if (usar) await recetaTool(project, docs, personal, { action: 'usar', slug: 'lanzamiento' });
  await planTool(project, { action: 'brief', respuestas: { idea: 'Editar con agentes', producto: 'Syka Studio', 'antes-despues': 'antes horas, ahora minutos', llamado: 'Gratis · Windows', canal: 'X 16:9' } });
  await planTool(project, { action: 'historias', historias: ['A', 'B', 'C'].map(nombre => ({ nombre, recurso: 'UI', forma: 'cortes', inicio: 'cursor', recorrido: 'gancho → logo' })) });
  await planTool(project, { action: 'elegir', indice: 0, por: 'delegado' });
}

describe('recetas y planes', () => {
  it('ships a valid factory launch recipe that lists with personal ones', async () => {
    const receta = validarReceta(JSON.parse(await readFile(join(docs, 'recetas/lanzamiento/receta.json'), 'utf8')));
    expect(receta.fases.historias).toBe(true);
    for (const slug of ['youtube', 'vertical']) expect(validarReceta(JSON.parse(await readFile(join(docs, `recetas/${slug}/receta.json`), 'utf8'))).slug).toBe(slug);
    const listed = await recetaTool(project, docs, personal, { action: 'listar' }) as { recetas: { slug: string; origen: string }[] };
    expect(listed.recetas).toContainEqual(expect.objectContaining({ slug: 'lanzamiento', origen: 'fábrica' }));
  });

  it('walks a new video through brief, storylines and scenes before building', async () => {
    const start = await recetaTool(project, docs, personal, { action: 'usar', slug: 'lanzamiento' }) as { fase: string; faltan: { id: string }[] };
    expect(start.fase).toBe('brief');
    expect(start.faltan.map(q => q.id)).toEqual(['idea', 'producto', 'antes-despues', 'llamado', 'canal']);
    await expect(recetaTool(project, docs, personal, { action: 'usar', slug: 'lanzamiento' })).rejects.toThrow(/ya tiene un plan/);
    await planHastaEscenas(false);
    expect((await planTool(project, { action: 'estado' }) as { fase: string }).fase).toBe('escenas');
    const saved = await planTool(project, { action: 'escenas', escenas: escenas(), duracion: 24, sonido, marca: 'logo' }) as unknown as { fase: string; guardado: boolean };
    expect(saved).toMatchObject({ guardado: true, fase: 'construir' });
    expect(await planLines(project)).toContainEqual({ id: 'demo', text: 'Pedilo y se edita', start: 6, end: 16 });
  });

  it('returns every scene problem at once and saves nothing', async () => {
    await planHastaEscenas();
    const broken = escenas();
    broken[1] = { ...broken[1]!, frase: 'Una frase demasiado larga para leer bien.' };
    broken[2] = { ...broken[2]!, inicio: 7, planos: [{ at: 7.5, distancia: 'general', pantalla: 'todo', movimiento: 'acercar' } as never] };
    const result = await planTool(project, { action: 'escenas', escenas: broken, duracion: 30, sonido }) as { guardado: boolean; errores: string[] };
    expect(result.guardado).toBe(false);
    expect(result.errores.join('\n')).toMatch(/hasta 6/);
    expect(result.errores.join('\n')).toMatch(/sin punto final/);
    expect(result.errores.join('\n')).toMatch(/donde termina la anterior/);
    expect(result.errores.join('\n')).toMatch(/tiene que llegar a algo/);
    expect(result.errores.join('\n')).toMatch(/termina en 24 s y la duración es 30/);
    expect(result.errores.join('\n')).toMatch(/marca: indicá la escena/);
    expect(result.errores.join('\n')).toMatch(/ui-legible/);
    expect((await planTool(project, { action: 'estado' }) as { fase: string }).fase).toBe('escenas');
  });

  it('limits planned hard cuts to a third of the seams', async () => {
    await planHastaEscenas();
    const hard = escenas().map((scene, i) => i < 3 ? { ...scene, costura: { tipo: 'corte-seco' } } : scene);
    const result = await planTool(project, { action: 'escenas', escenas: hard, duracion: 24, sonido, marca: 'logo' }) as { errores: string[] };
    expect(result.errores.join('\n')).toMatch(/3 de 4 costuras son cortes secos/);
  });

  it('holds a new piece until its plan is done and a gate passed on the final source', async () => {
    const deliver = (extra = {}) => projectDelivery(project, { status: 'ready', message: 'Listo', artifact: 'index.tsx', evidence: ['index.tsx'], ...extra });
    await expect(deliver()).rejects.toThrow(/necesita su plan/);
    await planHastaEscenas();
    await expect(deliver()).rejects.toThrow(/fase escenas/);
    await planTool(project, { action: 'escenas', escenas: escenas(), duracion: 24, sonido, marca: 'logo' });
    await expect(deliver()).rejects.toThrow(/Falta correr gate/);
    await writeGateReceipt(project, 'main', { passed: false, issues: [{ code: 'frozen', severity: 'error' }] });
    await expect(deliver()).rejects.toThrow(/falló.*frozen/);
    await writeGateReceipt(project, 'main', { passed: true, issues: [] });
    await expect(deliver()).resolves.toMatchObject({ kind: 'complete' });
    await writeFile(join(project, 'index.tsx'), 'export default () => 1;\n');
    await expect(deliver()).rejects.toThrow(/cambió después del último gate/);
    await expect(projectDelivery(project, { status: 'review', message: 'Avance', artifact: 'index.tsx' })).resolves.toMatchObject({ kind: 'review' });
  });

  it('lets a small correction skip the plan but never the gate', async () => {
    expect(await entregaBloqueada(project, true)).toMatch(/Falta correr gate/);
    await writeGateReceipt(project, 'main', { passed: true, issues: [] });
    expect(await entregaBloqueada(project, true)).toBeNull();
  });

  it('records corrections and storyboard approval with the person\'s words', async () => {
    await recetaTool(project, docs, personal, { action: 'usar', slug: 'lanzamiento', storyboard: true });
    await planHastaEscenas(false);
    await planTool(project, { action: 'escenas', escenas: escenas(), duracion: 24, sonido, marca: 'logo' });
    expect((await planTool(project, { action: 'estado' }) as { fase: string }).fase).toBe('storyboard');
    await expect(planTool(project, { action: 'aprobar' })).rejects.toThrow(/Citá las palabras/);
    expect(await planTool(project, { action: 'aprobar', palabras: 'dale' })).toMatchObject({ fase: 'construir' });
    expect(await planTool(project, { action: 'nota', pedido: 'subtítulos más chicos', cambio: '-10 %' })).toMatchObject({ notas: 1 });
  });

  it('saves a personal recipe as a draggable skill, keeping every revision', async () => {
    const base = JSON.parse(await readFile(join(docs, 'recetas/lanzamiento/receta.json'), 'utf8'));
    await expect(recetaTool(project, docs, personal, { action: 'guardar', receta: base, nota: 'x' })).rejects.toThrow(/de fábrica/);
    const mine = { ...base, slug: 'mi-lanzamiento', nombre: 'Mi lanzamiento', origen: { tipo: 'video-aprobado', detalle: 'golden-mountain' } };
    await recetaTool(project, docs, personal, { action: 'guardar', receta: mine, nota: 'Desde el video aprobado.' });
    expect(await readFile(join(personal, 'mi-lanzamiento', 'SKILL.md'), 'utf8')).toMatch(/^---\nname: mi-lanzamiento/);
    await expect(recetaTool(project, docs, personal, { action: 'guardar', receta: mine, nota: 'otra vez' })).rejects.toThrow(/revisión 1; guardá la 2/);
    await recetaTool(project, docs, personal, { action: 'guardar', receta: { ...mine, revision: 2 }, nota: 'Subtítulos 10 % más chicos.' });
    expect(await readFile(join(personal, 'mi-lanzamiento', 'historial', 'revision-1.json'), 'utf8')).toMatch(/"revision": 1/);
    expect(await readFile(join(personal, 'mi-lanzamiento', 'historial.md'), 'utf8')).toMatch(/Revisión 2[\s\S]*más chicos/);
  });

  it('offers once to keep a delivered video as a recipe, and again when new corrections arrive', async () => {
    expect(await ofertaDeReceta(project)).toBeNull();
    await planHastaEscenas();
    expect(await ofertaDeReceta(project)).toBeNull();
    await planTool(project, { action: 'escenas', escenas: escenas(), duracion: 24, sonido, marca: 'logo' });
    expect(await ofertaDeReceta(project)).toEqual({ mode: 'crear', receta: { slug: 'lanzamiento', nombre: 'Lanzamiento de producto' }, mejoras: [] });
    expect(await ofertaDeReceta(project)).toBeNull();
    await planTool(project, { action: 'nota', pedido: 'música más baja', cambio: '-3 dB' });
    expect(await ofertaDeReceta(project)).toMatchObject({ mode: 'crear', mejoras: ['música más baja → -3 dB'] });
  });

  it('offers to improve a personal recipe only with corrections to add', async () => {
    const base = JSON.parse(await readFile(join(docs, 'recetas/lanzamiento/receta.json'), 'utf8'));
    await recetaTool(project, docs, personal, { action: 'guardar', receta: { ...base, slug: 'mia', nombre: 'Mía', origen: { tipo: 'video-aprobado', detalle: 'x' } }, nota: 'primera' });
    await recetaTool(project, docs, personal, { action: 'usar', slug: 'mia' });
    await planHastaEscenas(false);
    await planTool(project, { action: 'escenas', escenas: escenas(), duracion: 24, sonido, marca: 'logo' });
    expect(await ofertaDeReceta(project)).toBeNull();
    await planTool(project, { action: 'nota', pedido: 'subtítulos más chicos' });
    expect(await ofertaDeReceta(project)).toEqual({ mode: 'mejorar', receta: { slug: 'mia', nombre: 'Mía' }, mejoras: ['subtítulos más chicos'] });
  });

  it('ignores folders in the skills directory that are not recipes', async () => {
    await mkdir(join(personal, 'otra-skill'));
    await writeFile(join(personal, 'otra-skill', 'SKILL.md'), '# skill');
    const listed = await recetaTool(project, docs, personal, { action: 'listar' }) as { recetas: { slug: string }[] };
    expect(listed.recetas.map(r => r.slug).sort()).toEqual(['lanzamiento', 'vertical', 'youtube']);
  });

  it('starts a YouTube edit from the recording and its real transcript, and allows jump cuts', async () => {
    await recetaTool(project, docs, personal, { action: 'usar', slug: 'youtube' });
    await planTool(project, { action: 'brief', respuestas: { idea: 'Cómo editar con agentes', publico: 'creadores', recortes: 'pausas y muletillas', graficos: 'títulos y b-roll', musica: 'Mixkit bajo la voz' } });
    expect((await planTool(project, { action: 'estado' }) as { fase: string }).fase).toBe('material');
    await expect(planTool(project, { action: 'material', fuente: '01 Crudos/toma.mp4', transcripcion: 'x.json' })).rejects.toThrow(/No encuentro el video fuente/);
    await mkdir(join(project, '01 Crudos'));
    await writeFile(join(project, '01 Crudos', 'toma.mp4'), 'video');
    await writeFile(join(project, 'toma.transcript.json'), '{"segments":[]}');
    await expect(planTool(project, { action: 'material', fuente: '../fuera.mp4', transcripcion: 'toma.transcript.json' })).rejects.toThrow(/dentro del proyecto/);
    expect(await planTool(project, { action: 'material', fuente: '01 Crudos/toma.mp4', transcripcion: 'toma.transcript.json' })).toMatchObject({ fase: 'escenas' });
    const talk = (id: string, inicio: number, fin: number, seccion: string, frase: string) =>
      ({ id, inicio, fin, seccion, frase, imagen: 'la persona hablando', planos: [{ at: inicio + 1, distancia: 'plano-medio', pantalla: 'cámara', movimiento: 'quieto' }], costura: { tipo: 'corte-seco' }, assets: [] });
    const saved = await planTool(project, { action: 'escenas', duracion: 180, sonido: { modo: 'voz' }, escenas: [
      talk('gancho', 0, 15, 'gancho', 'Editá en minutos'), talk('intro', 15, 30, 'intro', ''), talk('bloque-1', 30, 100, 'bloque', 'Primero, el brief'),
      talk('bloque-2', 100, 160, 'bloque', 'Después, el plan'), talk('cierre', 160, 180, 'cierre', 'Probalo hoy') ] }) as unknown as { guardado: boolean; fase: string };
    expect(saved).toMatchObject({ guardado: true, fase: 'construir' });
  });

  it('keeps vertical lines clear of the app buttons and opens on a hook', async () => {
    await recetaTool(project, docs, personal, { action: 'usar', slug: 'vertical' });
    await planTool(project, { action: 'brief', respuestas: { idea: 'Syka edita por vos', material: 'desde cero', gancho: 'el antes y después', red: 'Reels, seguir' } });
    const short = (id: string, inicio: number, fin: number, seccion: string, frase: string) =>
      ({ id, inicio, fin, seccion, frase, imagen: 'la app', planos: [{ at: inicio + 0.2, distancia: 'primer-plano', pantalla: 'la app', movimiento: 'quieto' }], costura: { tipo: 'corte-en-movimiento' }, assets: [] });
    const slowHook = await planTool(project, { action: 'escenas', duracion: 20, sonido: { modo: 'musica' }, escenas: [
      short('gancho', 0, 5, 'gancho', 'Mirá esto'), short('paso', 5, 15, 'desarrollo', 'Pedilo así'), short('remate', 15, 18, 'remate', 'Listo'), short('cierre', 18, 20, 'cierre', 'Seguinos') ] }) as { errores: string[] };
    expect(slowHook.errores.join('\n')).toMatch(/gancho-inmediato/);
    await planTool(project, { action: 'escenas', duracion: 20, sonido: { modo: 'musica' }, escenas: [
      short('gancho', 0, 2, 'gancho', 'Mirá esto'), short('paso', 2, 15, 'desarrollo', 'Pedilo así'), short('remate', 15, 18, 'remate', 'Listo'), short('cierre', 18, 20, 'cierre', 'Seguinos') ] });
    expect((await planLines(project))[0]).toMatchObject({ text: 'Mirá esto', margins: { top: 0.08, bottom: 0.2, left: 0.06, right: 0.15 } });
  });
});
